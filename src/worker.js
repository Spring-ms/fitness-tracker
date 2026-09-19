// Cloudflare Worker: JSON API backed by D1. Static files are served by the assets binding.
const SESSION_DAYS = 30;
const COOKIE_NAME = "ft_session";
const PBKDF2_ITERATIONS = 100000; // Workers' maximum for PBKDF2

const enc = new TextEncoder();
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });

// ---------- crypto helpers ----------
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64url = (buf) => b64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s) => unb64(s.replace(/-/g, "+").replace(/_/g, "/"));

async function pbkdf2(password, salt) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS }, key, 256);
}
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${b64(salt)}$${b64(await pbkdf2(password, salt))}`;
}
async function verifyPassword(password, stored) {
  const [saltB64, hashB64] = stored.split("$");
  const derived = new Uint8Array(await pbkdf2(password, unb64(saltB64)));
  const expected = unb64(hashB64);
  let diff = derived.length ^ expected.length;
  for (let i = 0; i < derived.length; i++) diff |= derived[i] ^ (expected[i] ?? 0);
  return diff === 0;
}
// Used when the email is unknown so response timing doesn't reveal which emails exist.
const DUMMY_HASH = `${b64(new Uint8Array(16))}$${b64(new Uint8Array(32))}`;

const hmacKey = (secret, usage) =>
  crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);

async function signSession(userId, secret) {
  const payload = b64url(enc.encode(JSON.stringify({ sub: userId, exp: Date.now() + SESSION_DAYS * 864e5 })));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}
async function readSession(token, secret) {
  const [payload, sig] = (token || "").split(".");
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret, "verify"), unb64url(sig), enc.encode(payload));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(unb64url(payload)));
    return data.exp > Date.now() ? data.sub : null;
  } catch {
    return null;
  }
}

function cookieHeader(request, value, maxAge) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}
function getCookie(request, name) {
  const match = (request.headers.get("Cookie") || "").match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? match[1] : "";
}

// ---------- validation ----------
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const num = (v, max = 1e7) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
};
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const validators = {
  workouts(b) {
    const exercise = str(b.exercise, 120);
    const sets = num(b.sets, 1000);
    const reps = num(b.reps, 10000);
    const weight = num(b.weight, 10000);
    if (!isDate(b.date) || !exercise || sets === null || reps === null || weight === null) return null;
    return { date: b.date, exercise, sets: Math.round(sets), reps: Math.round(reps), weight, notes: str(b.notes, 500) };
  },
  weights(b) {
    const weight = num(b.weight, 10000);
    return isDate(b.date) && weight ? { date: b.date, weight } : null;
  },
  calories(b) {
    const calories = num(b.calories, 100000);
    return isDate(b.date) && calories ? { date: b.date, food: str(b.food, 120), calories, estimated: b.estimated ? 1 : 0 } : null;
  },
};

function insertStmt(db, table, uid, row) {
  const cols = Object.keys(row);
  return db
    .prepare(`INSERT INTO ${table} (user_id, ${cols.join(", ")}) VALUES (?, ${cols.map(() => "?").join(", ")})`)
    .bind(uid, ...cols.map((c) => row[c]));
}

const userPayload = (u) => ({ email: u.email, weightUnit: u.weight_unit });

// ---------- handlers ----------
async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, "");
  const method = request.method;
  const db = env.DB;

  let body = {};
  if (method === "POST" || method === "PUT") {
    if (!(request.headers.get("Content-Type") || "").includes("application/json")) return json({ error: "Expected JSON" }, 415);
    try {
      body = (await request.json()) ?? {};
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
  }

  // --- public auth routes ---
  if (path === "/signup" && method === "POST") {
    const email = str(body.email, 254).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Enter a valid email." }, 400);
    if (password.length < 8 || password.length > 200) return json({ error: "Password must be 8–200 characters." }, 400);
    try {
      const res = await db
        .prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)")
        .bind(email, await hashPassword(password))
        .run();
      const token = await signSession(res.meta.last_row_id, env.JWT_SECRET);
      return json(userPayload({ email, weight_unit: "lbs" }), 201, {
        "Set-Cookie": cookieHeader(request, token, SESSION_DAYS * 86400),
      });
    } catch (e) {
      if (String(e.message).includes("UNIQUE")) return json({ error: "An account with that email already exists." }, 409);
      throw e;
    }
  }

  if (path === "/login" && method === "POST") {
    const email = str(body.email, 254).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    const user = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
    const ok = await verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) return json({ error: "Incorrect email or password." }, 401);
    const token = await signSession(user.id, env.JWT_SECRET);
    return json(userPayload(user), 200, { "Set-Cookie": cookieHeader(request, token, SESSION_DAYS * 86400) });
  }

  if (path === "/logout" && method === "POST") {
    return json({ ok: true }, 200, { "Set-Cookie": cookieHeader(request, "", 0) });
  }

  // --- authenticated routes ---
  const uid = await readSession(getCookie(request, COOKIE_NAME), env.JWT_SECRET);
  const user = uid && (await db.prepare("SELECT id, email, weight_unit FROM users WHERE id = ?").bind(uid).first());
  if (!user) return json({ error: "Not signed in" }, 401);

  if (path === "/me" && method === "GET") return json(userPayload(user));

  if (path === "/data" && method === "GET") {
    const [w, wt, c] = await db.batch([
      db.prepare("SELECT id, date, exercise, sets, reps, weight, notes FROM workouts WHERE user_id = ?").bind(user.id),
      db.prepare("SELECT id, date, weight FROM weights WHERE user_id = ?").bind(user.id),
      db.prepare("SELECT id, date, food, calories, estimated FROM calories WHERE user_id = ?").bind(user.id),
    ]);
    return json({
      settings: { weightUnit: user.weight_unit },
      workouts: w.results,
      weights: wt.results,
      calories: c.results.map((r) => ({ ...r, estimated: !!r.estimated })),
    });
  }

  if (path === "/settings" && method === "PUT") {
    if (body.weightUnit !== "lbs" && body.weightUnit !== "kg") return json({ error: "Invalid unit." }, 400);
    await db.prepare("UPDATE users SET weight_unit = ? WHERE id = ?").bind(body.weightUnit, user.id).run();
    return json({ weightUnit: body.weightUnit });
  }

  if (path === "/import" && method === "POST") {
    const stmts = [];
    for (const table of Object.keys(validators)) {
      const list = Array.isArray(body[table]) ? body[table].slice(0, 2000) : [];
      for (const item of list) {
        const row = validators[table](item || {});
        if (row) stmts.push(insertStmt(db, table, user.id, row));
      }
    }
    for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));
    return json({ imported: stmts.length });
  }

  const m = path.match(/^\/(workouts|weights|calories)(?:\/(\d+))?$/);
  if (m) {
    const [, table, id] = m;
    if (method === "POST" && !id) {
      const row = validators[table](body);
      if (!row) return json({ error: "Invalid entry." }, 400);
      const res = await insertStmt(db, table, user.id, row).run();
      const saved = { id: res.meta.last_row_id, ...row };
      if (table === "calories") saved.estimated = !!saved.estimated;
      return json(saved, 201);
    }
    if (method === "DELETE" && id) {
      await db.prepare(`DELETE FROM ${table} WHERE id = ? AND user_id = ?`).bind(Number(id), user.id).run();
      return json({ ok: true });
    }
  }

  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request, env) {
    // Only /api/* reaches here first; anything else is an unmatched static path.
    if (!new URL(request.url).pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });
    if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
      return json({ error: "Server is missing JWT_SECRET" }, 500);
    }
    try {
      return await handleApi(request, env);
    } catch (err) {
      console.error(err);
      return json({ error: "Server error" }, 500);
    }
  },
};

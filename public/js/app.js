function switchTab(tabName) {
  document.querySelectorAll(".tab-panel").forEach((el) => {
    el.classList.toggle("active", el.id === `tab-${tabName}`);
  });
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
  if (tabName === "dashboard") renderDashboard();
}

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------- Workouts ----------
function renderWorkoutList() {
  const list = Store.getWorkouts();
  const container = document.getElementById("workout-list");
  if (list.length === 0) {
    container.innerHTML = '<p class="empty">No workouts logged yet.</p>';
    return;
  }
  container.innerHTML = list
    .map(
      (w) => `
    <div class="entry-card">
      <div class="entry-main">
        <strong>${escapeHtml(w.exercise)}</strong>
        <span class="entry-meta">${fmtDate(w.date)} &middot; ${w.sets} x ${w.reps}${
        w.weight ? ` @ ${w.weight}${Store.getSettings().weightUnit}` : " (bodyweight)"
      }</span>
        ${w.notes ? `<span class="entry-notes">${escapeHtml(w.notes)}</span>` : ""}
      </div>
      <button class="delete-btn" data-kind="workout" data-id="${w.id}" aria-label="Delete">&times;</button>
    </div>`
    )
    .join("");
}

// ---------- Weight ----------
function renderWeightList() {
  const list = Store.getWeights().slice().reverse();
  const container = document.getElementById("weight-list");
  const unit = Store.getSettings().weightUnit;
  if (list.length === 0) {
    container.innerHTML = '<p class="empty">No weight entries yet.</p>';
    return;
  }
  container.innerHTML = list
    .map(
      (w) => `
    <div class="entry-card">
      <div class="entry-main">
        <strong>${w.weight} ${unit}</strong>
        <span class="entry-meta">${fmtDate(w.date)}</span>
      </div>
      <button class="delete-btn" data-kind="weight" data-id="${w.id}" aria-label="Delete">&times;</button>
    </div>`
    )
    .join("");
}

// ---------- Calories ----------
function renderCalorieList() {
  const list = Store.getCalories();
  const container = document.getElementById("calorie-list");
  if (list.length === 0) {
    container.innerHTML = '<p class="empty">No calorie entries yet.</p>';
    return;
  }
  container.innerHTML = list
    .map(
      (c) => `
    <div class="entry-card">
      <div class="entry-main">
        <strong>${c.calories} cal${c.estimated ? " (est.)" : ""}</strong>
        <span class="entry-meta">${fmtDate(c.date)}${c.food ? ` &middot; ${escapeHtml(c.food)}` : ""}</span>
      </div>
      <button class="delete-btn" data-kind="calorie" data-id="${c.id}" aria-label="Delete">&times;</button>
    </div>`
    )
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ---------- Dashboard ----------
function renderDashboard() {
  const settings = Store.getSettings();
  const weights = Store.getWeights();
  const calories = Store.getCalories();
  const workouts = Store.getWorkouts();

  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  const todayIso = today.toISOString().slice(0, 10);

  const todayCalories = calories
    .filter((c) => c.date === todayIso)
    .reduce((sum, c) => sum + Number(c.calories || 0), 0);
  document.getElementById("stat-today-calories").textContent = todayCalories
    ? `${todayCalories}`
    : "—";

  const latestWeight = weights[weights.length - 1];
  document.getElementById("stat-latest-weight").textContent = latestWeight
    ? `${latestWeight.weight} ${settings.weightUnit}`
    : "—";

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const weekAgoIso = weekAgo.toISOString().slice(0, 10);
  const workoutsThisWeek = workouts.filter((w) => w.date >= weekAgoIso).length;
  document.getElementById("stat-workouts-week").textContent = workoutsThisWeek;

  renderWeightChart("chart-weight", weights, settings.weightUnit);
  renderCaloriesChart("chart-calories", calories);
  renderWorkoutChart("chart-workouts", workouts);
}

// ---------- Settings ----------
function applySettingsToForm() {
  const settings = Store.getSettings();
  document.getElementById("settings-unit").value = settings.weightUnit;
}

// ---------- Auth ----------
// Runs a write; on failure shows the error (and returns to login if the session expired).
async function guarded(fn) {
  try {
    await fn();
  } catch (err) {
    if (err.status === 401) showAuth();
    else alert(err.message);
  }
}

function showAuth() {
  Store.clear();
  document.getElementById("auth-overlay").hidden = false;
  document.getElementById("app-root").hidden = true;
}

async function enterApp(user) {
  await Store.load();
  document.getElementById("auth-overlay").hidden = true;
  document.getElementById("app-root").hidden = false;
  document.getElementById("account-email").textContent = user.email;
  applySettingsToForm();
  await offerLegacyImport();
  renderWorkoutList();
  renderWeightList();
  renderCalorieList();
  switchTab("dashboard");
}

// Offer to move pre-account localStorage entries into the account.
async function offerLegacyImport() {
  const legacy = Store.getLegacyData();
  if (!legacy) return;
  const n = legacy.workouts.length + legacy.weights.length + legacy.calories.length;
  if (confirm(`Found ${n} entries saved in this browser from before accounts existed. Import them into your account?`)) {
    await guarded(async () => {
      await Store.importLegacy(legacy);
      Store.clearLegacyData();
      await Store.load();
    });
  }
}

async function boot() {
  try {
    await enterApp(await api("GET", "/api/me"));
  } catch {
    showAuth();
  }
}

function initAuth() {
  const form = document.getElementById("auth-form");
  const errorEl = document.getElementById("auth-error");
  const submitBtn = document.getElementById("auth-submit");
  const toggleBtn = document.getElementById("auth-toggle");
  let mode = "login";

  function render() {
    const login = mode === "login";
    document.getElementById("auth-title").textContent = login ? "Log in" : "Create account";
    submitBtn.textContent = login ? "Log in" : "Sign up";
    toggleBtn.textContent = login ? "Need an account? Sign up" : "Have an account? Log in";
    document.getElementById("auth-password").autocomplete = login ? "current-password" : "new-password";
    errorEl.textContent = "";
  }
  toggleBtn.addEventListener("click", () => {
    mode = mode === "login" ? "signup" : "login";
    render();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    errorEl.textContent = "";
    try {
      const user = await api("POST", mode === "login" ? "/api/login" : "/api/signup", {
        email: document.getElementById("auth-email").value,
        password: document.getElementById("auth-password").value,
      });
      form.reset();
      await enterApp(user);
    } catch (err) {
      errorEl.textContent = err.message;
    } finally {
      submitBtn.disabled = false;
    }
  });

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await api("POST", "/api/logout").catch(() => {});
    showAuth();
  });
  render();
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  const todayIso = todayISO();

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // Populate food datalist
  const foodList = document.getElementById("food-list");
  foodList.innerHTML = Object.keys(COMMON_FOODS)
    .map((name) => `<option value="${escapeHtml(name)}"></option>`)
    .join("");

  // Default dates to today
  document.getElementById("w-date").value = todayIso;
  document.getElementById("wt-date").value = todayIso;
  document.getElementById("c-date").value = todayIso;

  applySettingsToForm();

  // Workout form
  document.getElementById("workout-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const exercise = document.getElementById("w-exercise").value.trim();
    if (!exercise) return;
    await guarded(() => Store.addWorkout({
      date: document.getElementById("w-date").value || todayIso,
      exercise,
      sets: Number(document.getElementById("w-sets").value || 0),
      reps: Number(document.getElementById("w-reps").value || 0),
      weight: Number(document.getElementById("w-weight").value || 0),
      notes: document.getElementById("w-notes").value.trim(),
    }));
    e.target.reset();
    document.getElementById("w-date").value = todayIso;
    renderWorkoutList();
  });

  // Weight form
  document.getElementById("weight-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const weight = Number(document.getElementById("wt-weight").value);
    if (!weight) return;
    await guarded(() => Store.addWeight({
      date: document.getElementById("wt-date").value || todayIso,
      weight,
    }));
    e.target.reset();
    document.getElementById("wt-date").value = todayIso;
    renderWeightList();
  });

  // Calorie form
  const foodInput = document.getElementById("c-food");
  const caloriesInput = document.getElementById("c-calories");
  let userEditedCalories = false;
  caloriesInput.addEventListener("input", () => {
    userEditedCalories = true;
  });
  foodInput.addEventListener("input", () => {
    const est = estimateCaloriesFor(foodInput.value);
    if (est !== null && (!userEditedCalories || caloriesInput.value === "")) {
      caloriesInput.value = est;
      userEditedCalories = false;
    }
  });

  document.getElementById("calorie-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const calories = Number(caloriesInput.value);
    if (!calories) return;
    const food = foodInput.value.trim();
    await guarded(() => Store.addCalorieEntry({
      date: document.getElementById("c-date").value || todayIso,
      food,
      calories,
      estimated: estimateCaloriesFor(food) === calories,
    }));
    e.target.reset();
    document.getElementById("c-date").value = todayIso;
    userEditedCalories = false;
    renderCalorieList();
  });

  // Settings form
  document.getElementById("settings-unit").addEventListener("change", async (e) => {
    const settings = Store.getSettings();
    settings.weightUnit = e.target.value;
    await guarded(() => Store.saveSettings(settings));
    renderWeightList();
    renderWorkoutList();
  });

  // Delegated delete handling
  document.body.addEventListener("click", async (e) => {
    const btn = e.target.closest(".delete-btn");
    if (!btn) return;
    const { kind, id } = btn.dataset;
    if (kind === "workout") {
      await guarded(() => Store.deleteWorkout(id));
      renderWorkoutList();
    } else if (kind === "weight") {
      await guarded(() => Store.deleteWeight(id));
      renderWeightList();
    } else if (kind === "calorie") {
      await guarded(() => Store.deleteCalorieEntry(id));
      renderCalorieList();
    }
  });

  initAuth();
  boot();
});

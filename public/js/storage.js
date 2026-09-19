// Server-backed data layer. Data is loaded once after login into an in-memory
// cache (so reads stay synchronous); every write goes to the API first.
function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const LEGACY_KEYS = {
  workouts: "ft_workouts",
  weights: "ft_weights",
  calories: "ft_calories",
};

const cache = { settings: { weightUnit: "lbs" }, workouts: [], weights: [], calories: [] };

const Store = {
  async load() {
    const data = await api("GET", "/api/data");
    cache.settings = data.settings;
    cache.workouts = data.workouts;
    cache.weights = data.weights;
    cache.calories = data.calories;
  },
  clear() {
    cache.settings = { weightUnit: "lbs" };
    cache.workouts = [];
    cache.weights = [];
    cache.calories = [];
  },

  // Data saved in this browser before accounts existed.
  getLegacyData() {
    const out = {};
    let total = 0;
    for (const [kind, key] of Object.entries(LEGACY_KEYS)) {
      try {
        const list = JSON.parse(localStorage.getItem(key) || "[]");
        out[kind] = Array.isArray(list) ? list : [];
      } catch {
        out[kind] = [];
      }
      total += out[kind].length;
    }
    return total ? out : null;
  },
  clearLegacyData() {
    Object.values(LEGACY_KEYS).forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem("ft_settings");
  },
  importLegacy: (data) => api("POST", "/api/import", data),

  getSettings: () => ({ ...cache.settings }),
  async saveSettings(settings) {
    cache.settings = await api("PUT", "/api/settings", settings);
  },

  getWorkouts: () => cache.workouts.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
  async addWorkout(entry) {
    cache.workouts.push(await api("POST", "/api/workouts", entry));
  },
  async deleteWorkout(id) {
    await api("DELETE", `/api/workouts/${id}`);
    cache.workouts = cache.workouts.filter((w) => String(w.id) !== String(id));
  },

  getWeights: () => cache.weights.slice().sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id),
  async addWeight(entry) {
    cache.weights.push(await api("POST", "/api/weights", entry));
  },
  async deleteWeight(id) {
    await api("DELETE", `/api/weights/${id}`);
    cache.weights = cache.weights.filter((w) => String(w.id) !== String(id));
  },

  getCalories: () => cache.calories.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
  async addCalorieEntry(entry) {
    cache.calories.push(await api("POST", "/api/calories", entry));
  },
  async deleteCalorieEntry(id) {
    await api("DELETE", `/api/calories/${id}`);
    cache.calories = cache.calories.filter((c) => String(c.id) !== String(id));
  },
};

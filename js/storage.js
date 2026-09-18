// Simple localStorage-backed data layer. Everything stays on this device/browser.
const STORE_KEYS = {
  workouts: "ft_workouts",
  weights: "ft_weights",
  calories: "ft_calories",
  settings: "ft_settings",
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function readList(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

const Store = {
  getSettings() {
    try {
      const raw = localStorage.getItem(STORE_KEYS.settings);
      return raw ? JSON.parse(raw) : { weightUnit: "lbs" };
    } catch {
      return { weightUnit: "lbs" };
    }
  },
  saveSettings(settings) {
    localStorage.setItem(STORE_KEYS.settings, JSON.stringify(settings));
  },

  getWorkouts() {
    return readList(STORE_KEYS.workouts).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  },
  addWorkout(entry) {
    const list = readList(STORE_KEYS.workouts);
    list.push({ id: uid(), ...entry });
    writeList(STORE_KEYS.workouts, list);
  },
  deleteWorkout(id) {
    writeList(
      STORE_KEYS.workouts,
      readList(STORE_KEYS.workouts).filter((w) => w.id !== id)
    );
  },

  getWeights() {
    return readList(STORE_KEYS.weights).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  },
  addWeight(entry) {
    const list = readList(STORE_KEYS.weights);
    list.push({ id: uid(), ...entry });
    writeList(STORE_KEYS.weights, list);
  },
  deleteWeight(id) {
    writeList(
      STORE_KEYS.weights,
      readList(STORE_KEYS.weights).filter((w) => w.id !== id)
    );
  },

  getCalories() {
    return readList(STORE_KEYS.calories).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  },
  addCalorieEntry(entry) {
    const list = readList(STORE_KEYS.calories);
    list.push({ id: uid(), ...entry });
    writeList(STORE_KEYS.calories, list);
  },
  deleteCalorieEntry(id) {
    writeList(
      STORE_KEYS.calories,
      readList(STORE_KEYS.calories).filter((c) => c.id !== id)
    );
  },
};

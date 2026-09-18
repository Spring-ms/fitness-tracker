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
  document.getElementById("workout-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const exercise = document.getElementById("w-exercise").value.trim();
    if (!exercise) return;
    Store.addWorkout({
      date: document.getElementById("w-date").value || todayIso,
      exercise,
      sets: Number(document.getElementById("w-sets").value || 0),
      reps: Number(document.getElementById("w-reps").value || 0),
      weight: Number(document.getElementById("w-weight").value || 0),
      notes: document.getElementById("w-notes").value.trim(),
    });
    e.target.reset();
    document.getElementById("w-date").value = todayIso;
    renderWorkoutList();
  });

  // Weight form
  document.getElementById("weight-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const weight = Number(document.getElementById("wt-weight").value);
    if (!weight) return;
    Store.addWeight({
      date: document.getElementById("wt-date").value || todayIso,
      weight,
    });
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

  document.getElementById("calorie-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const calories = Number(caloriesInput.value);
    if (!calories) return;
    const food = foodInput.value.trim();
    Store.addCalorieEntry({
      date: document.getElementById("c-date").value || todayIso,
      food,
      calories,
      estimated: estimateCaloriesFor(food) === calories,
    });
    e.target.reset();
    document.getElementById("c-date").value = todayIso;
    userEditedCalories = false;
    renderCalorieList();
  });

  // Settings form
  document.getElementById("settings-unit").addEventListener("change", (e) => {
    const settings = Store.getSettings();
    settings.weightUnit = e.target.value;
    Store.saveSettings(settings);
    renderWeightList();
  });

  // Delegated delete handling
  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest(".delete-btn");
    if (!btn) return;
    const { kind, id } = btn.dataset;
    if (kind === "workout") {
      Store.deleteWorkout(id);
      renderWorkoutList();
    } else if (kind === "weight") {
      Store.deleteWeight(id);
      renderWeightList();
    } else if (kind === "calorie") {
      Store.deleteCalorieEntry(id);
      renderCalorieList();
    }
  });

  renderWorkoutList();
  renderWeightList();
  renderCalorieList();
  renderDashboard();
});

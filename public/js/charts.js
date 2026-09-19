// Thin wrappers around Chart.js (loaded from CDN in index.html).
const chartInstances = {};

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

function lastNDates(n) {
  const dates = [];
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  for (let i = n - 1; i >= 0; i--) {
    const day = new Date(d);
    day.setDate(day.getDate() - i);
    dates.push(day.toISOString().slice(0, 10));
  }
  return dates;
}

function formatShortDate(iso) {
  const [, m, day] = iso.split("-");
  return `${parseInt(m, 10)}/${parseInt(day, 10)}`;
}

function renderWeightChart(canvasId, weights, unit) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const points = weights.slice(-60);
  chartInstances[canvasId] = new Chart(ctx, {
    type: "line",
    data: {
      labels: points.map((p) => formatShortDate(p.date)),
      datasets: [
        {
          label: `Body weight (${unit})`,
          data: points.map((p) => p.weight),
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59,130,246,0.15)",
          tension: 0.25,
          fill: true,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: false } },
      plugins: { legend: { display: false } },
    },
  });
}

function renderCaloriesChart(canvasId, calorieEntries) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const days = lastNDates(14);
  const totals = days.map((day) =>
    calorieEntries
      .filter((c) => c.date === day)
      .reduce((sum, c) => sum + Number(c.calories || 0), 0)
  );
  chartInstances[canvasId] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: days.map(formatShortDate),
      datasets: [
        {
          label: "Calories",
          data: totals,
          backgroundColor: "#f97316",
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { display: false } },
    },
  });
}

function renderWorkoutChart(canvasId, workouts) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const days = lastNDates(14);
  const volumes = days.map((day) =>
    workouts
      .filter((w) => w.date === day)
      .reduce((sum, w) => sum + Number(w.sets || 0) * Number(w.reps || 0) * Number(w.weight || 0), 0)
  );
  chartInstances[canvasId] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: days.map(formatShortDate),
      datasets: [
        {
          label: "Volume (sets x reps x weight)",
          data: volumes,
          backgroundColor: "#10b981",
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { display: false } },
    },
  });
}

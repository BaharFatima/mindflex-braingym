import { fetchSessions } from "./fetchSessions.js";
import {
  getDailyDistractionRate,
  getDailyAvgDuration,
  getDailySwitchCount,
  getFocusedVsDistracted,
  getStatCards,
  getHeatmapGrid,
  getBestProductivityWindow
} from "./processing.js";


let distractionChart;
let switchChart;
let durationChart;
let pieChart;


// MAIN FUNCTION
export async function renderDashboard(days = 7) {

  const sessions = await fetchSessions(days);

  if (!sessions || sessions.length === 0) {
    console.warn("No session data found");
    return;
  }

  // PROCESS DATA
  const distractionData = getDailyDistractionRate(sessions);
  const durationData = getDailyAvgDuration(sessions);
  const switchData = getDailySwitchCount(sessions);
  const pieData = getFocusedVsDistracted(sessions);
  const stats = getStatCards(sessions);

  const heatmapGrid = getHeatmapGrid(sessions);
  const bestWindow = getBestProductivityWindow(heatmapGrid);


  updateStatCards(stats);
  updatePieChart(pieData);

  updateLineChart(distractionChart, distractionData);
  updateLineChart(switchChart, switchData);
  updateBarChart(durationChart, durationData);

  updateHeatmap(heatmapGrid);

  document.getElementById("productivity-window").innerText =
    "Best window: " + bestWindow.label;
}



// ------------------------------
// STAT CARDS
// ------------------------------

function updateStatCards(stats) {

  document.getElementById("stat-total").innerText =
    stats.total;

  document.getElementById("stat-distraction-rate").innerText =
    stats.distractionRate + "%";

  document.getElementById("stat-avg-duration").innerText =
    Math.round(stats.avgDuration) + "s";

  document.getElementById("stat-streak").innerText =
    "🔥 " + stats.streak;
}



// ------------------------------
// CHART UPDATES
// ------------------------------

function updateLineChart(chart, data) {

  chart.data.labels = data.labels;
  chart.data.datasets[0].data = data.values;
  chart.update();
}

function updateBarChart(chart, data) {

  chart.data.labels = data.labels;
  chart.data.datasets[0].data = data.values;
  chart.update();
}

function updatePieChart(data) {

  pieChart.data.datasets[0].data = [
    data.focused,
    data.distracted
  ];

  pieChart.update();

  const total = data.focused + data.distracted;

  const focusPercent = Math.round((data.focused / total) * 100);
  const distractPercent = 100 - focusPercent;

  document.getElementById("label-focused").innerText =
    focusPercent + "% Focused";

  document.getElementById("label-distracted").innerText =
    distractPercent + "% Distracted";
}



// ------------------------------
// HEATMAP
// ------------------------------

function updateHeatmap(grid) {

  const heatmapBody = document.getElementById("heatmap-grid");
  heatmapBody.innerHTML = "";

  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  grid.forEach((row, dayIndex) => {

    const rowDiv = document.createElement("div");
    rowDiv.className = "heatmap-row";

    const label = document.createElement("div");
    label.className = "heatmap-day-label";
    label.innerText = days[dayIndex];

    rowDiv.appendChild(label);

    row.forEach(value => {

      const cell = document.createElement("div");
      cell.classList.add("heatmap-cell");

      if (value === null) cell.classList.add("cell-none");
      else if (value >= 0.75) cell.classList.add("cell-high");
      else if (value >= 0.5) cell.classList.add("cell-good");
      else if (value >= 0.25) cell.classList.add("cell-mixed");
      else cell.classList.add("cell-low");

      rowDiv.appendChild(cell);
    });

    heatmapBody.appendChild(rowDiv);
  });
}



// ------------------------------
// INITIALIZE CHARTS
// ------------------------------

function initCharts() {

  distractionChart = new Chart(
    document.getElementById("chart-distraction"),
    {
      type: "line",
      data: { labels: [], datasets: [{ data: [] }] }
    }
  );

  switchChart = new Chart(
    document.getElementById("chart-switches"),
    {
      type: "line",
      data: { labels: [], datasets: [{ data: [] }] }
    }
  );

  durationChart = new Chart(
    document.getElementById("chart-duration"),
    {
      type: "bar",
      data: { labels: [], datasets: [{ data: [] }] }
    }
  );

  pieChart = new Chart(
    document.getElementById("chart-pie"),
    {
      type: "doughnut",
      data: {
        labels: ["Focused", "Distracted"],
        datasets: [{ data: [0,0] }]
      }
    }
  );
}



// ------------------------------
// TOGGLE BUTTONS
// ------------------------------

window.setToggle = function(days){

  document.getElementById("btn7").className =
    "toggle-btn " + (days === 7 ? "active" : "inactive");

  document.getElementById("btn30").className =
    "toggle-btn " + (days === 30 ? "active" : "inactive");

  renderDashboard(days);
}



// ------------------------------
// PAGE LOAD
// ------------------------------

document.addEventListener("DOMContentLoaded", () => {

  initCharts();
  renderDashboard(7);

});
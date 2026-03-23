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


// ------------------------------
// MAIN FUNCTION
// ------------------------------
export async function renderDashboard(days = 7) {

  const sessions = await fetchSessions(days);

  if (!sessions || sessions.length === 0) {
    console.warn("No session data found");
    return;
  }

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

  document.getElementById("stat-total").innerText = stats.total;

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
// INITIALIZE CHARTS (UI FIXED HERE)
// ------------------------------
function initCharts() {

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#013C88',
        padding: 6,
        cornerRadius: 6
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(0,119,182,0.06)' },
        ticks: { color: '#7A9BBF', font: { size: 8 } }
      },
      y: {
        grid: { color: 'rgba(0,119,182,0.06)' },
        ticks: { color: '#7A9BBF', font: { size: 8 } },
        beginAtZero: true
      }
    }
  };

  const lineDataset = {
    data: [],
    borderColor: '#00B4D8',
    borderWidth: 2.5,
    pointBackgroundColor: '#FFFFFF',
    pointBorderColor: '#00B4D8',
    pointBorderWidth: 2,
    pointRadius: 3.5,
    pointHoverRadius: 5,
    fill: true,
    tension: 0.4,
    backgroundColor: (ctx) => {
      const { chart } = ctx;
      const { ctx: c, chartArea } = chart;
      if (!chartArea) return 'transparent';

      const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
      gradient.addColorStop(0, 'rgba(0,180,216,0.38)');
      gradient.addColorStop(0.5, 'rgba(144,224,239,0.18)');
      gradient.addColorStop(1, 'rgba(144,224,239,0)');
      return gradient;
    }
  };

  distractionChart = new Chart(
    document.getElementById("chart-distraction"),
    {
      type: "line",
      data: { labels: [], datasets: [lineDataset] },
      options: commonOptions
    }
  );

  switchChart = new Chart(
    document.getElementById("chart-switches"),
    {
      type: "line",
      data: { labels: [], datasets: [lineDataset] },
      options: commonOptions
    }
  );

  durationChart = new Chart(
    document.getElementById("chart-duration"),
    {
      type: "bar",
      data: {
        labels: [],
        datasets: [{
          data: [],
          borderRadius: 5,
          borderSkipped: false,
          backgroundColor: (ctx) => {
            const { chart } = ctx;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return '#00B4D8';

            const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, '#00B4D8');
            gradient.addColorStop(1, '#03045E');
            return gradient;
          }
        }]
      },
      options: commonOptions
    }
  );

  pieChart = new Chart(
    document.getElementById("chart-pie"),
    {
      type: "doughnut",
      data: {
        labels: ["Focused", "Distracted"],
        datasets: [{
          data: [0, 0],
          backgroundColor: ['#00B4D8', '#013C88'],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '74%',
        plugins: { legend: { display: false } }
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
// PAGE LOAD (AUTH SAFE)
// ------------------------------
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {

  initCharts();

  const auth = getAuth();

  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("User logged in:", user.uid);
      renderDashboard(7);
    } else {
      console.warn("No user → redirecting to login");
      window.location.href = "./login.html";
    }
  });

});

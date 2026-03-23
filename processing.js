// Helper: group sessions by date string "YYYY-MM-DD"
function groupByDate(sessions) {
  return sessions.reduce((acc, s) => {
    const date = new Date(s.timestamp).toISOString().split("T")[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(s);
    return acc;
  }, {});
}

// 1. Daily distraction rate
// Returns { labels: ["2025-06-01", ...], values: [45.5, ...] }
export function getDailyDistractionRate(sessions) {
  const grouped = groupByDate(sessions);
  const labels = Object.keys(grouped).sort();
  const values = labels.map(date => {
    const day = grouped[date];
    const distracted = day.filter(s => s.distraction_label === 1).length;
    return parseFloat(((distracted / day.length) * 100).toFixed(1));
  });
  return { labels, values };
}

// 2. Daily average session duration
// Returns { labels: [...], values: [...] } — values in seconds
export function getDailyAvgDuration(sessions) {
  const grouped = groupByDate(sessions);
  const labels = Object.keys(grouped).sort();
  const values = labels.map(date => {
    const day = grouped[date];
    const avg = day.reduce((sum, s) => sum + s.session_duration, 0) / day.length;
    return parseFloat(avg.toFixed(1));
  });
  return { labels, values };
}

// 3. Daily average switch count
// Returns { labels: [...], values: [...] }
export function getDailySwitchCount(sessions) {
  const grouped = groupByDate(sessions);
  const labels = Object.keys(grouped).sort();
  const values = labels.map(date => {
    const day = grouped[date];
    const avg = day.reduce((sum, s) => sum + s.switch_count, 0) / day.length;
    return parseFloat(avg.toFixed(1));
  });
  return { labels, values };
}

// 4. Total focused vs distracted session counts
// Returns { focused: Number, distracted: Number }
export function getFocusedVsDistracted(sessions) {
  const focused = sessions.filter(s => s.distraction_label === 0).length;
  const distracted = sessions.filter(s => s.distraction_label === 1).length;
  return { focused, distracted };
}

// 5. Stat card values
// Returns { total, distractionRate, avgDuration, streak }
export function getStatCards(sessions) {
  const total = sessions.length;
  const distracted = sessions.filter(s => s.distraction_label === 1).length;
  const distractionRate = total > 0
    ? parseFloat(((distracted / total) * 100).toFixed(1))
    : 0;
  const avgDuration = total > 0
    ? parseFloat((sessions.reduce((sum, s) => sum + s.session_duration, 0) / total).toFixed(1))
    : 0;

  // Streak: count consecutive focused sessions from most recent, stop at first distracted
  const sorted = [...sessions].sort((a, b) => b.timestamp - a.timestamp);
  let streak = 0;
  for (const s of sorted) {
    if (s.distraction_label === 0) streak++;
    else break;
  }

  return { total, distractionRate, avgDuration, streak };
}

// 6. Heatmap grid — 7 rows (Sun–Sat) x 24 columns (hours 0–23)
// Returns a 2D array grid[day][hour] = focus rate (0.0–1.0) or null
export function getHeatmapGrid(sessions) {
  // Build a 7x24 structure of session buckets
  const buckets = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => []));

  for (const s of sessions) {
    const d = new Date(s.timestamp);
    const day = d.getDay();   // 0 = Sun, 6 = Sat
    const hour = d.getHours(); // 0–23
    buckets[day][hour].push(s);
  }

  // Convert buckets to focus rates
  return buckets.map(dayRow =>
    dayRow.map(slot => {
      if (slot.length === 0) return null;
      const focused = slot.filter(s => s.distraction_label === 0).length;
      return parseFloat((focused / slot.length).toFixed(2));
    })
  );
}

// 7. Best productivity window from heatmap grid
// Returns { hour: Number, label: "9am to 10am" }
export function getBestProductivityWindow(grid) {
  const hourAverages = [];

  for (let hour = 0; hour < 24; hour++) {
    const rates = [];
    for (let day = 0; day < 7; day++) {
      const val = grid[day][hour];
      if (val !== null) rates.push(val);
    }
    hourAverages.push(rates.length > 0
      ? rates.reduce((a, b) => a + b, 0) / rates.length
      : null
    );
  }

  // Find hour with highest average focus rate
  let bestHour = 0;
  let bestRate = -1;
  for (let h = 0; h < 24; h++) {
    if (hourAverages[h] !== null && hourAverages[h] > bestRate) {
      bestRate = hourAverages[h];
      bestHour = h;
    }
  }

  // Format readable label e.g. "9am to 10am"
  const fmt = h => {
    if (h === 0) return "12am";
    if (h < 12) return `${h}am`;
    if (h === 12) return "12pm";
    return `${h - 12}pm`;
  };

  return {
    hour: bestHour,
    label: `${fmt(bestHour)} to ${fmt((bestHour + 1) % 24)}`
  };
}

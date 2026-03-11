
// Contains functions that process raw session data into
// chart-ready and UI-ready values.
//
// Each session object is expected to have:
// { userId, pageName, timestamp, session_duration, switch_count,
//   restart_count, inactivity_seconds, distraction_label, distraction_text }
// ============================================================

// ------------------------------------------------------------
// HELPER: Group sessions by date string "YYYY-MM-DD"
// ------------------------------------------------------------
function groupByDate(sessions) {
  return sessions.reduce((acc, s) => {
    const date = new Date(s.timestamp).toISOString().split("T")[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(s);
    return acc;
  }, {});
}

// ------------------------------------------------------------
// 1. getDailyDistractionRate(sessions)
// Groups sessions by date, calculates what % were distracted
// (distraction_label === 1) per day.
// Returns: { labels: ["2025-06-01", ...], values: [45.5, ...] }
// ------------------------------------------------------------
function getDailyDistractionRate(sessions) {
  const grouped = groupByDate(sessions);
  const labels = Object.keys(grouped).sort();
  const values = labels.map(date => {
    const day = grouped[date];
    const distracted = day.filter(s => s.distraction_label === 1).length;
    return parseFloat(((distracted / day.length) * 100).toFixed(1));
  });
  return { labels, values };
}

// ------------------------------------------------------------
// 2. getDailyAvgDuration(sessions)
// Groups sessions by date, averages session_duration per day.
// Returns: { labels: [...], values: [...] }  (values in seconds)
// ------------------------------------------------------------
function getDailyAvgDuration(sessions) {
  const grouped = groupByDate(sessions);
  const labels = Object.keys(grouped).sort();
  const values = labels.map(date => {
    const day = grouped[date];
    const avg = day.reduce((sum, s) => sum + s.session_duration, 0) / day.length;
    return parseFloat(avg.toFixed(1));
  });
  return { labels, values };
}

// ------------------------------------------------------------
// 3. getDailySwitchCount(sessions)
// Groups sessions by date, averages switch_count per day.
// Returns: { labels: [...], values: [...] }
// ------------------------------------------------------------
function getDailySwitchCount(sessions) {
  const grouped = groupByDate(sessions);
  const labels = Object.keys(grouped).sort();
  const values = labels.map(date => {
    const day = grouped[date];
    const avg = day.reduce((sum, s) => sum + s.switch_count, 0) / day.length;
    return parseFloat(avg.toFixed(1));
  });
  return { labels, values };
}

// ------------------------------------------------------------
// 4. getFocusedVsDistracted(sessions)
// Counts total focused (label 0) vs distracted (label 1) sessions.
// Returns: { focused: Number, distracted: Number }
// ------------------------------------------------------------
function getFocusedVsDistracted(sessions) {
  const focused = sessions.filter(s => s.distraction_label === 0).length;
  const distracted = sessions.filter(s => s.distraction_label === 1).length;
  return { focused, distracted };
}

// ------------------------------------------------------------
// 5. getStatCards(sessions)
// Calculates values for the 4 stat cards at the top of the dashboard.
// Streak = consecutive focused sessions from most recent, stops at first distracted.
// Returns: { total, distractionRate, avgDuration, streak }
// ------------------------------------------------------------
function getStatCards(sessions) {
  const total = sessions.length;
  const distracted = sessions.filter(s => s.distraction_label === 1).length;
  const distractionRate = total > 0
    ? parseFloat(((distracted / total) * 100).toFixed(1))
    : 0;
  const avgDuration = total > 0
    ? parseFloat((sessions.reduce((sum, s) => sum + s.session_duration, 0) / total).toFixed(1))
    : 0;

  // Sort newest first, count focused streak until first distracted session
  const sorted = [...sessions].sort((a, b) => b.timestamp - a.timestamp);
  let streak = 0;
  for (const s of sorted) {
    if (s.distraction_label === 0) streak++;
    else break;
  }

  return { total, distractionRate, avgDuration, streak };
}

// ------------------------------------------------------------
// 6. getHeatmapGrid(sessions)
// Builds a 7 (days) x 24 (hours) grid of focus rates.
// Rows = day of week (0 = Sun, 6 = Sat)
// Columns = hour of day (0–23)
// Each cell = focused sessions / total sessions for that slot (0.0–1.0)
// Empty slots = null
// Returns: 2D array grid[day][hour]
// ------------------------------------------------------------
function getHeatmapGrid(sessions) {
  // Initialise empty buckets for every day/hour slot
  const buckets = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => [])
  );

  for (const s of sessions) {
    const d = new Date(s.timestamp);
    const day = d.getDay();    // 0 = Sun … 6 = Sat
    const hour = d.getHours(); // 0–23
    buckets[day][hour].push(s);
  }

  // Convert each bucket to a focus rate (or null if no data)
  return buckets.map(dayRow =>
    dayRow.map(slot => {
      if (slot.length === 0) return null;
      const focused = slot.filter(s => s.distraction_label === 0).length;
      return parseFloat((focused / slot.length).toFixed(2));
    })
  );
}

// ------------------------------------------------------------
// 7. getBestProductivityWindow(grid)
// Finds the hour of the day with the highest average focus rate
// across all 7 days (nulls are skipped).
// Returns: { hour: Number, label: "9am to 10am" }
// ------------------------------------------------------------
function getBestProductivityWindow(grid) {
  const hourAverages = [];

  for (let hour = 0; hour < 24; hour++) {
    const rates = [];
    for (let day = 0; day < 7; day++) {
      const val = grid[day][hour];
      if (val !== null) rates.push(val);
    }
    hourAverages.push(
      rates.length > 0
        ? rates.reduce((a, b) => a + b, 0) / rates.length
        : null
    );
  }

  // Find the hour with the highest average focus rate
  let bestHour = 0;
  let bestRate = -1;
  for (let h = 0; h < 24; h++) {
    if (hourAverages[h] !== null && hourAverages[h] > bestRate) {
      bestRate = hourAverages[h];
      bestHour = h;
    }
  }

  // Format hour number into readable label e.g. "9am to 10am"
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

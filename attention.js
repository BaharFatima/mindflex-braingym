/* ======================================================
   MINDFLEX - ATTENTION TRACKER v3.0
   Random Forest Model (7 variables) + Firebase Logging
   Drop into ANY Focus Lab game page

   HOW TO USE:
   1. Add to your HTML page:
      <script type="module" src="attention.js"></script>
   2. Make sure forest.json is in the same folder
   3. That's it — runs automatically!

   OPTIONAL — call these from your game pages:
      window.registerSwitch()    → user switched section
      window.registerRestart()   → user restarted activity

   WHAT IT TRACKS (7 variables):
      session_duration          → seconds since page open
      switch_count              → section switches
      restart_count             → activity restarts
      inactivity_seconds        → idle time in seconds
      response_time_variance    → std dev of click gaps (focus consistency)
      rage_clicks               → rapid clicks under 500ms (frustration)
      tab_switches              → times user left the tab
====================================================== */

/* =============================================
   FIREBASE SETUP
============================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD9bnmF1N44Nkuk3WZQjK9z4gRE00VRmCY",
  authDomain: "mindflex-b2a0c.firebaseapp.com",
  projectId: "mindflex-b2a0c",
  storageBucket: "mindflex-b2a0c.firebasestorage.app",
  messagingSenderId: "148676867562",
  appId: "1:148676847562:web:3365a72b6fa6b3751cee93",
  measurementId: "G-Q2T6HD3S0E"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* =============================================
   RANDOM FOREST MODEL
   Loads forest.json and runs predictions
============================================= */
let forest = null;

async function loadForest() {
  try {
    const res = await fetch("forest.json");
    forest = await res.json();
    console.log("✅ Random Forest model loaded! (7-variable v3.0)");
  } catch (err) {
    console.error("❌ Could not load forest.json. Make sure it's in the same folder.", err);
  }
}

// One tree making a decision
function predictTree(node, features) {
  if (node.leaf) return node.value;
  const val = features[node.feature];
  return val <= node.threshold
    ? predictTree(node.left, features)
    : predictTree(node.right, features);
}

// All 10 trees vote — majority wins
function predictForest(features) {
  if (!forest) return 0;
  const votes = forest.map(tree => predictTree(tree, features));
  const distractedVotes = votes.filter(v => v === 1).length;
  return distractedVotes > votes.length / 2 ? 1 : 0;
}

/* =============================================
   SESSION TRACKING
   Tracks all 7 variables the model needs
============================================= */
const Session = {
  startTime: Date.now(),
  lastInteraction: Date.now(),
  inactivitySeconds: 0,
  switchCount: 0,
  restartCount: 0,

  // NEW: response time variance
  clickTimestamps: [],          // last N click times to calc std dev

  // NEW: rage clicks
  rageClicks: 0,                // clicks < 500ms after previous click
  lastClickTime: null,

  // NEW: tab switches
  tabSwitches: 0,               // times user left the tab

  // Internal
  distractionCount: 0,          // consecutive distracted readings
  sessionLogged: false,
  pageName: document.title || window.location.pathname
};

/* =============================================
   GLOBAL FUNCTIONS (call from game pages)
============================================= */
window.registerSwitch = function () {
  Session.switchCount++;
  Session.lastInteraction = Date.now();
  console.log(`🔀 Switch registered. Total: ${Session.switchCount}`);
};

window.registerRestart = function () {
  Session.restartCount++;
  Session.lastInteraction = Date.now();
  console.log(`🔁 Restart registered. Total: ${Session.restartCount}`);
};

/* =============================================
   RESPONSE TIME VARIANCE HELPER
   Std dev of gaps between recent clicks
   Low = consistent/focused, High = erratic/distracted
============================================= */
function calcResponseTimeVariance() {
  const times = Session.clickTimestamps;
  if (times.length < 2) return 0;

  const gaps = [];
  for (let i = 1; i < times.length; i++) {
    gaps.push((times[i] - times[i - 1]) / 1000); // convert to seconds
  }

  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const variance = gaps.reduce((sum, g) => sum + Math.pow(g - mean, 2), 0) / gaps.length;
  return Math.round(Math.sqrt(variance) * 100) / 100; // std dev, 2dp
}

/* =============================================
   EVENT LISTENERS
============================================= */

// Click — rage clicks + response time variance + inactivity reset
document.addEventListener("click", () => {
  const now = Date.now();

  // rage click: under 500ms since last click
  if (Session.lastClickTime !== null && (now - Session.lastClickTime) < 500) {
    Session.rageClicks++;
    console.log(`😤 Rage click. Total: ${Session.rageClicks}`);
  }
  Session.lastClickTime = now;

  // keep last 20 clicks for variance calc
  Session.clickTimestamps.push(now);
  if (Session.clickTimestamps.length > 20) Session.clickTimestamps.shift();

  Session.lastInteraction = now;
});

// Keyboard + touch reset inactivity
["keydown", "touchstart"].forEach(event => {
  document.addEventListener(event, () => {
    Session.lastInteraction = Date.now();
  });
});

// Tab visibility — count tab switches
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    Session.tabSwitches++;
    console.log(`👁 Tab switch. Total: ${Session.tabSwitches}`);
  } else {
    // came back — reset inactivity so we don't double-penalise
    Session.lastInteraction = Date.now();
  }
});

// Inactivity counter — every second
setInterval(() => {
  if (Date.now() - Session.lastInteraction > 3000) {
    Session.inactivitySeconds++;
  }
}, 1000);

/* =============================================
   BUILD FEATURES FOR THE MODEL (all 7)
============================================= */
function getFeatures() {
  return {
    session_duration:         Math.floor((Date.now() - Session.startTime) / 1000),
    switch_count:             Session.switchCount,
    restart_count:            Session.restartCount,
    inactivity_seconds:       Session.inactivitySeconds,
    response_time_variance:   calcResponseTimeVariance(),
    rage_clicks:              Session.rageClicks,
    tab_switches:             Session.tabSwitches
  };
}

/* =============================================
   FIREBASE LOGGING
   Saves full session to Firestore on page leave

   Collection: "sessions"
   Fields: userId, pageName, timestamp,
           session_duration, switch_count, restart_count,
           inactivity_seconds, response_time_variance,
           rage_clicks, tab_switches,
           distraction_label, distraction_text
============================================= */
async function logSessionToFirebase(features, label) {
  try {
    const user = auth.currentUser;
    const sessionData = {
      userId:                   user ? user.uid : "anonymous",
      pageName:                 Session.pageName,
      timestamp:                new Date().toISOString(),
      session_duration:         features.session_duration,
      switch_count:             features.switch_count,
      restart_count:            features.restart_count,
      inactivity_seconds:       features.inactivity_seconds,
      response_time_variance:   features.response_time_variance,
      rage_clicks:              features.rage_clicks,
      tab_switches:             features.tab_switches,
      distraction_label:        label,
      distraction_text:         label === 1 ? "distracted" : "focused"
    };

    await addDoc(collection(db, "sessions"), sessionData);
    console.log("✅ Session logged to Firebase:", sessionData);
  } catch (err) {
    console.error("❌ Firebase logging failed:", err);
  }
}

/* =============================================
   POPUP NOTIFICATION
   Shows after 2 consecutive distracted readings
   Manual dismiss only via "Got it!" button
============================================= */
function showDistractionPopup() {
  if (document.getElementById("attention-popup")) return;

  // inject animation style once
  if (!document.getElementById("mf-popup-style")) {
    const style = document.createElement("style");
    style.id = "mf-popup-style";
    style.textContent = `
      @keyframes mfFadeIn {
        from { opacity: 0; transform: translateX(-50%) translateY(12px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  const popup = document.createElement("div");
  popup.id = "attention-popup";
  popup.innerHTML = `
    <div style="margin-bottom:10px;font-size:15px;font-weight:600;font-family:'Poppins',sans-serif;">
      Attention slipping!
    </div>
    <div style="font-size:13px;margin-bottom:14px;font-family:'Poppins',sans-serif;opacity:0.92;">
      Maybe it's time to take a break?
    </div>
    <button id="attention-popup-dismiss" style="
      background:#fff;
      color:#0077B6;
      border:none;
      border-radius:20px;
      padding:7px 20px;
      font-size:13px;
      font-family:'Poppins',sans-serif;
      font-weight:600;
      cursor:pointer;
      display:block;
      margin:0 auto;
    ">Got it!</button>
  `;

  Object.assign(popup.style, {
    position:     "fixed",
    bottom:       "24px",
    left:         "50%",
    transform:    "translateX(-50%)",
    background:   "#0077B6",
    color:        "#fff",
    padding:      "16px 22px",
    borderRadius: "16px",
    boxShadow:    "0 8px 24px rgba(0,0,0,0.22)",
    zIndex:       "9999",
    minWidth:     "220px",
    textAlign:    "center",
    animation:    "mfFadeIn 0.35s ease"
  });

  document.body.appendChild(popup);

  document.getElementById("attention-popup-dismiss").addEventListener("click", () => {
    popup.remove();
  });
}

/* =============================================
   MAIN PREDICTION LOOP — every 10 seconds
   Early trigger: idle >= 45s AND session < 120s → force distracted
============================================= */
setInterval(() => {
  const features = getFeatures();

  const earlyTrigger = features.inactivity_seconds >= 45 && features.session_duration < 120;
  const result = earlyTrigger ? 1 : predictForest(features);

  console.log("📊 Attention check:", features);
  console.log(result === 1 ? "⚠ DISTRACTED" : "✅ FOCUSED");

  if (result === 1) {
    Session.distractionCount++;
    if (Session.distractionCount >= 2) {
      showDistractionPopup();
      Session.distractionCount = 0;
    }
  } else {
    Session.distractionCount = 0;
  }

}, 10000);

/* =============================================
   LOG SESSION ON PAGE LEAVE
============================================= */
window.addEventListener("beforeunload", () => {
  if (!Session.sessionLogged) {
    Session.sessionLogged = true;
    const features = getFeatures();
    const finalLabel = predictForest(features);
    logSessionToFirebase(features, finalLabel);
  }
});

/* =============================================
   INITIALIZE
============================================= */
loadForest();

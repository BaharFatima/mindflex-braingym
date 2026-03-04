/* ======================================================
   MINDFLEX - ATTENTION TRACKER v2.0
   Random Forest Model + Firebase Session Logging
   Drop into ANY page inside Focus Lab games
   
   HOW TO USE:
   1. Add this script to your HTML page as a module:
      <script type="module" src="attention.js"></script>
   2. Make sure forest.json is in the same folder
   3. That's it — it runs automatically!
   
   OPTIONAL - call these from your game pages:
      registerSwitch()      → when user switches section
      registerRestart()     → when user restarts activity
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
  appId: "1:148676867562:web:3365a72b6fa6b3751cee93",
  measurementId: "G-Q2T6HD3S0E"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* =============================================
   RANDOM FOREST MODEL
   Loads forest.json and runs predictions
   Think of it as loading 10 referees' rulebooks
============================================= */
let forest = null;

async function loadForest() {
  try {
    const res = await fetch("forest.json");
    forest = await res.json();
    console.log("✅ Random Forest model loaded!");
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

// All 10 trees voting — majority wins
function predictForest(features) {
  if (!forest) return 0; // default to focused if model not loaded yet
  const votes = forest.map(tree => predictTree(tree, features));
  const distractedVotes = votes.filter(v => v === 1).length;
  return distractedVotes > votes.length / 2 ? 1 : 0;
}

/* =============================================
   SESSION TRACKING
   Tracks the 4 variables the model needs
============================================= */
const Session = {
  startTime: Date.now(),
  lastInteraction: Date.now(),
  inactivitySeconds: 0,
  switchCount: 0,
  restartCount: 0,
  distractionCount: 0,      // consecutive distracted readings
  sessionLogged: false,     // ensures we only log once per session
  pageName: document.title || window.location.pathname
};

// Call this when user switches to a different section
window.registerSwitch = function () {
  Session.switchCount++;
  Session.lastInteraction = Date.now();
  console.log(`🔀 Switch registered. Total: ${Session.switchCount}`);
};

// Call this when user restarts an activity
window.registerRestart = function () {
  Session.restartCount++;
  Session.lastInteraction = Date.now();
  console.log(`🔁 Restart registered. Total: ${Session.restartCount}`);
};

// Runs every second — counts idle time
setInterval(() => {
  const now = Date.now();
  if (now - Session.lastInteraction > 3000) {
    Session.inactivitySeconds++;
  }
}, 1000);

/* =============================================
   BUILD FEATURES FOR THE MODEL
============================================= */
function getFeatures() {
  return {
    session_duration: Math.floor((Date.now() - Session.startTime) / 1000),
    switch_count: Session.switchCount,
    restart_count: Session.restartCount,
    inactivity_seconds: Session.inactivitySeconds
  };
}

/* =============================================
   FIREBASE LOGGING
   Saves one session document to Firestore
   
   Collection: "sessions"
   Document fields:
     userId, pageName, timestamp,
     session_duration, switch_count,
     restart_count, inactivity_seconds,
     distraction_label (0=focused, 1=distracted),
     distraction_text ("focused" or "distracted")
============================================= */
async function logSessionToFirebase(features, label) {
  try {
    const user = auth.currentUser;
    const sessionData = {
      userId: user ? user.uid : "anonymous",
      pageName: Session.pageName,
      timestamp: new Date().toISOString(),
      session_duration: features.session_duration,
      switch_count: features.switch_count,
      restart_count: features.restart_count,
      inactivity_seconds: features.inactivity_seconds,
      distraction_label: label,
      distraction_text: label === 1 ? "distracted" : "focused"
    };

    await addDoc(collection(db, "sessions"), sessionData);
    console.log("✅ Session logged to Firebase:", sessionData);
  } catch (err) {
    console.error("❌ Firebase logging failed:", err);
  }
}

/* =============================================
   POPUP NOTIFICATION
   Gentle nudge when distraction is detected
============================================= */
function showDistractionPopup() {
  if (document.getElementById("attention-popup")) return;
  const popup = document.createElement("div");
  popup.id = "attention-popup";
  popup.innerHTML = `
    <strong>⚠ Focus slipping</strong><br>
    You seem distracted.<br>
    Try taking a short break 🌿
  `;
  Object.assign(popup.style, {
    position: "fixed",
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#1565C0",
    color: "#fff",
    padding: "14px 20px",
    borderRadius: "14px",
    fontFamily: "Poppins, sans-serif",
    fontSize: "14px",
    boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
    zIndex: 9999,
    animation: "fadeIn 0.4s ease"
  });
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 5000);
}

/* =============================================
   MAIN PREDICTION LOOP
   Checks every 10 seconds
============================================= */
setInterval(() => {
  const features = getFeatures();
  const result = predictForest(features);

  console.log("📊 Attention features:", features);
  console.log(result === 1 ? "⚠ DISTRACTED" : "✅ FOCUSED");

  if (result === 1) {
    Session.distractionCount++;
    if (Session.distractionCount >= 2) { // 2 consecutive distracted readings = show popup
      showDistractionPopup();
      Session.distractionCount = 0;
    }
  } else {
    Session.distractionCount = 0;
  }
}, 10000);

/* =============================================
   LOG SESSION WHEN USER LEAVES PAGE
   Saves final session data to Firebase
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
   AUTO HOOK BASIC EVENTS
============================================= */
["click", "keydown", "touchstart"].forEach(event => {
  document.addEventListener(event, () => {
    Session.lastInteraction = Date.now();
  });
});

/* =============================================
   INITIALIZE — load the model on startup
============================================= */
loadForest();

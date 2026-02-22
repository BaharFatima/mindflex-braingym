/* ======================================================
   ADHD ATTENTION TRACKER (Reusable)
   Drop into ANY page
   No CSV | No Backend | GitHub Pages safe
====================================================== */

/* ---------- Math Helpers ---------- */
function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

function dot(a, b) {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

/* ---------- Logistic Regression ---------- */
class LogisticRegression {
  constructor() {
    // Pre-trained weights (tuned for behavior patterns)
    this.weights = [0.025, 0.04, 0.015, -0.03];
    this.bias = -1.8;
  }

  predict(x) {
    const z = dot(x, this.weights) + this.bias;
    return sigmoid(z) >= 0.5 ? 1 : 0;
  }
}

/* ---------- Session Tracking ---------- */
const AttentionSession = {
  startTime: Date.now(),
  lastInteraction: Date.now(),
  idleSeconds: 0,
  interactions: 0,
  correctActions: 0,
  distractionCount: 0
};

// register any interaction
function registerAttentionEvent(correct = false) {
  AttentionSession.interactions++;
  if (correct) AttentionSession.correctActions++;
  AttentionSession.lastInteraction = Date.now();
}

// detect idle time
setInterval(() => {
  const now = Date.now();
  if (now - AttentionSession.lastInteraction > 3000) {
    AttentionSession.idleSeconds++;
  }
}, 1000);

/* ---------- Feature Builder ---------- */
function getAttentionFeatures() {
  const sessionTime = Math.floor(
    (Date.now() - AttentionSession.startTime) / 1000
  );

  const accuracy =
    AttentionSession.interactions === 0
      ? 0
      : (AttentionSession.correctActions /
          AttentionSession.interactions) *
        100;

  return [
    sessionTime,                 // session length
    AttentionSession.idleSeconds,// inactivity
    AttentionSession.interactions,
    accuracy
  ];
}

/* ---------- Popup Notification ---------- */
function showAttentionPopup() {
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

/* ---------- Prediction Loop ---------- */
const attentionModel = new LogisticRegression();

setInterval(() => {
  const features = getAttentionFeatures();
  const result = attentionModel.predict(features);

  console.log("Attention features:", features);
  console.log(
    result === 1 ? "⚠ DISTRACTED" : "✅ FOCUSED"
  );

  if (result === 1) {
    AttentionSession.distractionCount++;

    // show popup only if distraction persists
    if (AttentionSession.distractionCount >= 2) {
      showAttentionPopup();
      AttentionSession.distractionCount = 0;
    }
  } else {
    AttentionSession.distractionCount = 0;
  }
}, 10000);

/* ---------- Auto Hook Basic Events ---------- */
["click", "keydown", "touchstart"].forEach(event => {
  document.addEventListener(event, () =>
    registerAttentionEvent(false)
  );
});

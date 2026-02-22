// ===== GLOBAL VARIABLES =====
window.extractedText = "";
window.speechRate = 1.0;

const video = document.getElementById("video");
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

// ===== CAMERA START =====
navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  .then(stream => {
    video.srcObject = stream;
    console.log("Camera started");
  })
  .catch(err => {
    alert("Camera error: " + err.message);
    console.error(err);
  });

// ===== SCAN TEXT =====
window.scanText = function () {
  console.log("scanText called");

  if (!video || video.videoWidth === 0) {
    alert("Camera not ready");
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);

  document.getElementById("outputText").value = "Scanning…";

  Tesseract.recognize(canvas, "eng")
    .then(({ data: { text } }) => {
      window.extractedText = text.trim();
      document.getElementById("outputText").value =
        window.extractedText || "No text detected";
    })
    .catch(err => {
      alert("OCR error");
      console.error(err);
    });
};

// ===== READ TEXT =====
window.speakText = function () {
  console.log("speakText called");

  if (!window.extractedText) {
    alert("No text to read");
    return;
  }

  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(window.extractedText);
  u.rate = window.speechRate;
  speechSynthesis.speak(u);
};

// ===== SPEED =====
window.increaseSpeed = function () {
  window.speechRate = Math.min(1.5, +(window.speechRate + 0.1).toFixed(1));
  updateSpeedUI();
};

window.decreaseSpeed = function () {
  window.speechRate = Math.max(0.5, +(window.speechRate - 0.1).toFixed(1));
  updateSpeedUI();
};

function updateSpeedUI() {
  const el = document.getElementById("speedDisplay");
  if (el) el.innerText = "Speed: " + window.speechRate;
}

import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function saveSession(gameName, db, currentUser) {

  if (!currentUser || !currentUser.uid) {
    console.warn("saveSession: no user logged in");
    return;
  }

  await addDoc(collection(db, "users", currentUser.uid, "sessions"), {
    timestamp:           Timestamp.now(),
    duration:            120,        // hardcoded for now ✅
    focusScore:          48,         // hardcoded for now ✅
    gameName:            gameName,
    sessionCompleted:    true,
    distractionDetected: 3,          // hardcoded for now ✅
    switchCount:         2,          // hardcoded for now ✅
    distractionLog:      []          // empty for now ✅
  });

  console.log(`✅ Session saved for ${gameName}!`);
}
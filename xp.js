// xp.js

import { doc, updateDoc, increment, getDoc } 
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/**
 * Add XP to a user
 */
export async function addXP(db, user, amount) {
  if (!user) return;

  const userRef = doc(db, "users", user.uid);

  await updateDoc(userRef, {
    points: increment(amount)   // ✅ changed from xp → points
  });
}

/**
 * Get current XP
 */
export async function getXP(db, user) {
  if (!user) return 0;

  const snap = await getDoc(doc(db, "users", user.uid));
  return snap.exists() ? snap.data().points || 0 : 0; // ✅ changed here too
}
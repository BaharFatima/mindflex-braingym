import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export async function fetchSessions(days = 7) {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      console.warn("fetchSessions: no user logged in, returning []");
      return [];
    }

    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceTimestamp = Timestamp.fromDate(since);

    const db = getFirestore();
    const sessionsRef = collection(db, "users", user.uid, "sessions");

    const q = query(
      sessionsRef,
      where("timestamp", ">=", sinceTimestamp),
      orderBy("timestamp", "asc")
    );

    const snapshot = await getDocs(q);
    const sessions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(`fetchSessions(${days}): found ${sessions.length} session(s)`);
    return sessions;

  } catch (error) {
    console.error("fetchSessions: Firestore query failed →", error);
    return [];
  }
}w
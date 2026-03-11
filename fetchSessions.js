//import {
  //getFirestore,
  //collection,
  //query,
  //where,
  //orderBy,
  //getDocs,
  //Timestamp,
//} from "firebase/firestore";
//import { getAuth } from "firebase/auth";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import "./firebaseConfig.js";

// ------------------------------------------------------------
//  fetchSessions(days)
//
//  Retrieves session data from Firestore for the current user.
//  Returns an array of session objects used to generate
//  charts and statistics in the analytics dashboard.
//
//  Usage:
//    const sessions = await fetchSessions(7);   // last 7 days
//    const sessions = await fetchSessions(30);  // last 30 days
//
//  Each session object looks like:
//  {
//    id:                   "abc123",
//    timestamp:            Timestamp,
//    duration:             120,
//    focusScore:           78,
//    distractionsDetected: 3,
//    gameName:             "sudoku",
//    sessionCompleted:     true,
//  }
//
//  Safe to call anytime:
//    • No user logged in  → returns []
//    • Firestore error    → logs it, returns []
// ------------------------------------------------------------

export async function fetchSessions(days = 7) {
  try {
    // 1. Make sure someone is logged in
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      console.warn("fetchSessions: no user logged in, returning []");
      return [];
    }

    // 2. Calculate the start date (today minus X days)
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceTimestamp = Timestamp.fromDate(since);

    // 3. Point to this user's sessions subcollection
    const db = getFirestore();
    const sessionsRef = collection(db, "users", user.uid, "sessions");

    // 4. Build the query — filter by date, order oldest → newest
    const q = query(
      sessionsRef,
      where("timestamp", ">=", sinceTimestamp),
      orderBy("timestamp", "asc")
    );

    // 5. Run the query and convert documents to plain JS objects
    const snapshot = await getDocs(q);
    const sessions = snapshot.docs.map((doc) => {
  const data = doc.data();

  return {
    id: doc.id,
    ...data,
    timestamp: data.timestamp.toDate()
  };
});

    console.log(`fetchSessions(${days}): found ${sessions.length} session(s)`);
    return sessions;

  } catch (error) {
    console.error("fetchSessions: Firestore query failed →", error);
    return [];
  }
}
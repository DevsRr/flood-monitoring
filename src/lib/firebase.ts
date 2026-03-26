import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, off, query, limitToLast, orderByChild, set, push, update } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDVLgBYZRQ25jOH3q141w1dyj2kTxUWNDE",
  authDomain: "flood-8b67b.firebaseapp.com",
  databaseURL: "https://flood-8b67b-default-rtdb.firebaseio.com",
  projectId: "flood-8b67b",
  storageBucket: "flood-8b67b.firebasestorage.app",
  messagingSenderId: "291996255511",
  appId: "1:291996255511:web:965357ecba48038af7a352",
  measurementId: "G-XTCVVPJ0MK"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);

export const DB_PATHS = {
  CURRENT: 'floodmonitoring',
  HISTORY: 'floodmonitoring/history',
} as const;

export const dbHelpers = {
  getCurrentRef: () => {
    return ref(database, DB_PATHS.CURRENT);
  },

  getHistoryRef: (limit: number = 100) => {
    return query(
      ref(database, DB_PATHS.HISTORY),
      limitToLast(limit)
    );
  },
};

export { ref, onValue, off, query, limitToLast, orderByChild, set, push, update };
export default app;
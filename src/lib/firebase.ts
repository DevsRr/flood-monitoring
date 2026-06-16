import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase, ref, onValue, off, query, limitToLast, orderByChild, set, push, update, get } from 'firebase/database';

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

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const database = getDatabase(app);
export const auth = getAuth(app);

export const DB_PATHS = {
  CURRENT: 'floodmonitoring',
  CURRENT_STATUS: 'floodmonitoring/currentStatus',
  SENSORS: 'floodmonitoring/sensors',
  HISTORY: 'floodmonitoring/history',
  USERS: 'floodmonitoring/users',
} as const;

export const dbHelpers = {
  getCurrentRef: () => {
    return ref(database, DB_PATHS.CURRENT_STATUS);
  },

  getHistoryRef: (limit: number = 100) => {
    return query(
      ref(database, DB_PATHS.HISTORY),
      limitToLast(limit)
    );
  },

  getHistoryRecordRef: (recordKey: string) => {
    return ref(database, `${DB_PATHS.HISTORY}/${recordKey}`);
  },

  getUsersRef: () => {
    return ref(database, DB_PATHS.USERS);
  },

  getUserRef: (uid: string) => {
    return ref(database, `${DB_PATHS.USERS}/${uid}`);
  },

  getSensorsRef: () => {
    return ref(database, DB_PATHS.SENSORS);
  },
};

export { ref, onValue, off, query, limitToLast, orderByChild, set, push, update, get };
export default app;

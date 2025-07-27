import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const WARDS = [
  'ศัลยกรรมชาย',
  'ศัลยกรรมหญิง',
  'อายุรกรรมชาย',
  'อายุรกรรมหญิง',
  'กุมารเวชกรรม',
  'สูตินรีเวชกรรม',
  'ER',
  'OPD',
  'ศัลยกรรมกระดูก',
  'ศัลยกรรมทั่วไป',
  'ICU',
  'CCU'
];

export const SHIFT_TYPES = {
  MORNING: 1,
  AFTERNOON: 2,
  NIGHT: 3
};

export const SHIFT_NAMES = {
  [SHIFT_TYPES.MORNING]: 'เช้า',
  [SHIFT_TYPES.AFTERNOON]: 'บ่าย',
  [SHIFT_TYPES.NIGHT]: 'ดึก'
};

export const checkWardHasAdmin = async (ward, excludeUserId = null) => {
  const q = query(
    collection(db, 'users'),
    where('currentWard', '==', ward),
    where('isAdmin', '==', true)
  );
  const snapshot = await getDocs(q);
  const admins = snapshot.docs.filter(doc => doc.id !== excludeUserId);
  return admins.length > 0;
};

export const getWardAdmins = async (ward) => {
  const q = query(
    collection(db, 'users'),
    where('currentWard', '==', ward),
    where('isAdmin', '==', true)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
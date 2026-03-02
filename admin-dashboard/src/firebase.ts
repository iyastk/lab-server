import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD4CrSE46gSxUPRARHvJCerihWSrZV3YuM",
  authDomain: "lab-server-f6d09.firebaseapp.com",
  projectId: "lab-server-f6d09",
  storageBucket: "lab-server-f6d09.firebasestorage.app",
  messagingSenderId: "1073626408708",
  appId: "1:1073626408708:web:f02ab5b1e1ea4e69095251",
  measurementId: "G-HR8CDF6CRP"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;

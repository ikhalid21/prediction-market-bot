import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAqtnspM0S0ZewDIKSHtGJD7Vc_dOh_v58",
  authDomain: "nfl-picks-475f8.firebaseapp.com",
  projectId: "nfl-picks-475f8",
  storageBucket: "nfl-picks-475f8.firebasestorage.app",
  messagingSenderId: "1044551301214",
  appId: "1:1044551301214:web:d94212ae2fd5a49463dccf",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

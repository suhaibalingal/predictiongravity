/**
 * Firebase Config & Initialization for World Cup 2026 Prediction Competition
 * 
 * Replace the placeholder values in the firebaseConfig object below with your actual
 * Firebase project credentials. You can find them in your Firebase Console:
 * Project Settings > General > Your Apps > Web App.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB58PgpZHXiFi1-2bYIaCIo6tsBYluPgnw",
  authDomain: "predict-8ae3e.firebaseapp.com",
  projectId: "predict-8ae3e",
  storageBucket: "predict-8ae3e.firebasestorage.app",
  messagingSenderId: "921410230801",
  appId: "1:921410230801:web:5c7780bad1ad0d5065efb0"
};

// Simple check to verify if the user has replaced placeholder values
const isConfigured = firebaseConfig.projectId && firebaseConfig.projectId !== "YOUR_PROJECT_ID" && firebaseConfig.apiKey !== "YOUR_API_KEY";

let app;
let db;

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
}

export { 
  db, 
  isConfigured, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp 
};

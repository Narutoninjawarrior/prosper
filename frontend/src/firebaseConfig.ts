import { initializeApp } from "firebase/app";
// import { getFirestore } from "firebase/firestore";

// TODO: Replace with your actual Firebase config for the Community Mutual-Aid Ledger
const firebaseConfig = {
  apiKey: "PLACEHOLDER_API_KEY",
  authDomain: "cottagecommons.firebaseapp.com",
  projectId: "cottagecommons-ledger",
  storageBucket: "cottagecommons-ledger.appspot.com",
  messagingSenderId: "PLACEHOLDER_ID",
  appId: "PLACEHOLDER_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// export const db = getFirestore(app);

export default app;

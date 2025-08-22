// Import the functions you need from the SDKs you need
import { FirebaseApp, initializeApp } from "firebase/app";
import { Firestore, initializeFirestore } from "firebase/firestore";
import { FirebaseStorage, getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAG9D8uY9Is0jY5e5P4TibyPN1MQvPhFnw",
  authDomain: "cfo-app-27460.firebaseapp.com",
  projectId: "cfo-app-27460",
  storageBucket: "cfo-app-27460.firebasestorage.app",
  messagingSenderId: "337696114348",
  appId: "1:337696114348:web:4f05313f230d93cbfd8109",
  measurementId: "G-YCX15YDNP3"
};

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);

// Firebase Analytics is not supported on React Native; avoid importing it on native platforms.
// If you need analytics on web, you can import it dynamically in web-only code.

export const db: Firestore = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});
export const storage: FirebaseStorage = getStorage(app);
export default app;
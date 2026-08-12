import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from "firebase/auth";

// Replace these values with your Firebase Web App configuration from Firebase Console:
// https://console.firebase.google.com/ -> Project Settings -> General -> Your apps
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_FIREBASE_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "your-app.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "your-app-id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "your-app.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:1234567890",
};

// Initialize Firebase App & Auth with resilient persistence fallback
const app = initializeApp(firebaseConfig);

let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  });
} catch {
  authInstance = getAuth(app);
}

export const auth = authInstance;

// Action code settings to redirect user back to app after email link click
const getActionCodeSettings = () => ({
  url: window.location.origin,
  handleCodeInApp: true,
});

// 1. Sign Up & Send Real Verification Email
export async function signUpUser(email, password, displayName) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  if (displayName) {
    await updateProfile(user, { displayName });
  }

  // Send email verification link to user's inbox with app redirect URL
  try {
    await sendEmailVerification(user, getActionCodeSettings());
  } catch {
    await sendEmailVerification(user);
  }
  return user;
}

// 2. Sign In with Email Verification Check
export async function loginUser(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Reload user state to get latest emailVerified status from Firebase servers
  await user.reload().catch(() => {});

  // Check if email has been verified
  if (!user.emailVerified) {
    throw new Error(
      "Your email is not verified yet. Please check your inbox and click the verification link before logging in."
    );
  }

  return user;
}

// 3. Resend Verification Email
export async function resendVerificationEmail() {
  if (auth.currentUser) {
    try {
      await sendEmailVerification(auth.currentUser, getActionCodeSettings());
    } catch {
      await sendEmailVerification(auth.currentUser);
    }
  } else {
    throw new Error("No user currently logged in.");
  }
}

// 4. Send Password Reset Email
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

// 5. Sign Out
export async function logoutFirebaseUser() {
  await signOut(auth);
}

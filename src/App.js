import { getAnalytics } from "firebase/analytics";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { createContext, useEffect, useState } from "react";
import AdminPanel from "./components/AdminPanel";
import Header from "./components/Header";
import PostDetail from "./components/PostDetail";
import PostList from "./components/PostList";
import LoginCallback from "./pages/LoginCallback";

import "./index.css";

// --- Firebase Configuration and Initialization ---
// These global variables are provided by the Canvas environment.
const appId = process.env.REACT_APP_FIREBASE_APP_ID;
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: appId,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

// --- Context for Firebase and User State ---
export const FirebaseContext = createContext(null);

function FirebaseProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [dbInstance, setDbInstance] = useState(null);
  const [authInstance, setAuthInstance] = useState(null);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google sign-in error:", error);
    }
  };

  useEffect(() => {
    const initFirebase = async () => {
      setDbInstance(db);
      setAuthInstance(auth);

      // Listen for auth state changes
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setUserId(currentUser?.uid || crypto.randomUUID()); // Use UID if authenticated, else a random ID
        setIsAuthReady(true);
      });

      return () => unsubscribe();
    };

    initFirebase();
  }, []); // Run only once on mount

  return (
    <FirebaseContext.Provider
      value={{
        db: dbInstance,
        auth: authInstance,
        user,
        userId,
        isAuthReady,
        signInWithGoogle,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
}

// Main App component
export default function App() {
  const [currentPage, setCurrentPage] = useState("home");
  const [selectedPost, setSelectedPost] = useState(null);

  const handleSelectPost = (post) => {
    setSelectedPost(post);
    setCurrentPage("postDetail");
  };

  const handleBackToPosts = () => {
    setSelectedPost(null);
    setCurrentPage("home");
  };

  const navigate = (page) => {
    setCurrentPage(page);
    setSelectedPost(null);
  };

  useEffect(() => {
    const path = window.location.pathname;
    if (path === "/login-callback") {
      setCurrentPage("loginCallback");
    }
  }, []);

  return (
    <FirebaseProvider>
      <div className="min-h-screen bg-gray-100 font-inter antialiased">
        <Header navigate={navigate} currentPage={currentPage} />
        <main className="container mx-auto py-8">
          {currentPage === "home" && !selectedPost && (
            <PostList onSelectPost={handleSelectPost} navigate={navigate} />
          )}
          {currentPage === "postDetail" && selectedPost && (
            <PostDetail post={selectedPost} onBack={handleBackToPosts} />
          )}
          {currentPage === "admin" && <AdminPanel />}
          {currentPage === "loginCallback" && (
            <LoginCallback navigate={navigate} />
          )}
        </main>
      </div>
    </FirebaseProvider>
  );
}

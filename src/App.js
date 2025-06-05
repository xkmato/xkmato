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
import {
  Route,
  BrowserRouter as Router,
  Routes,
  useNavigate,
} from "react-router-dom";
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

function AppRoutes() {
  const navigate = useNavigate();
  const [selectedPost] = useState(null);

  // You may want to fetch the post by ID here if needed

  return (
    <>
      <Header navigate={navigate} />
      <main className="container mx-auto py-8">
        <Routes>
          <Route
            path="/"
            element={
              <PostList
                onSelectPost={(post) =>
                  navigate(`/post/${post.userId}/${post.id}`)
                }
                navigate={navigate}
              />
            }
          />
          <Route
            path="/post/:userId/:postId"
            element={
              <PostDetail
                post={selectedPost /* fetch by postId */}
                onBack={() => navigate("/")}
              />
            }
          />
          <Route path="/admin" element={<AdminPanel />} />
          <Route
            path="/login-callback"
            element={<LoginCallback navigate={navigate} />}
          />
        </Routes>
      </main>
    </>
  );
}

// Main App component
export default function App() {
  return (
    <FirebaseProvider>
      <Router>
        <AppRoutes />
      </Router>
    </FirebaseProvider>
  );
}

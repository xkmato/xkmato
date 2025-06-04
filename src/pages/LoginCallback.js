import {
  getAuth,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from "firebase/auth";
import { useEffect, useState } from "react";

const LoginCallback = ({ navigate }) => {
  // Accept navigate as a prop
  const auth = getAuth();
  const [message, setMessage] = useState("Processing sign-in...");

  useEffect(() => {
    const handleSignIn = async () => {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        let email = localStorage.getItem("emailForSignIn");
        if (!email) {
          email = window.prompt("Please provide your email for confirmation:");
        }
        if (!email) {
          setMessage("Email not provided. Sign-in failed.");
          // Optionally, navigate to a login prompt page or show an error page
          // if (navigate) setTimeout(() => navigate('login'), 3000);
          return;
        }

        try {
          await signInWithEmailLink(auth, email, window.location.href);
          localStorage.removeItem("emailForSignIn");
          setMessage("Successfully signed in! Redirecting to home...");
          if (navigate) {
            // Clean up the URL by removing the sign-in link parameters
            window.history.replaceState({}, document.title, "/");
            setTimeout(() => navigate("home"), 2000); // Redirect to home page
          }
        } catch (error) {
          console.error("Error signing in with email link:", error);
          setMessage(`Sign-in failed: ${error.message}`);
          // Optionally, navigate to a login error page
          // if (navigate) setTimeout(() => navigate('login'), 3000);
        }
      } else {
        setMessage("Invalid sign-in link.");
        // Optionally redirect if the link is not a sign-in link
        // if (navigate) setTimeout(() => navigate('login'), 3000);
      }
    };
    handleSignIn();
  }, [auth, navigate]); // Add navigate to dependency array

  return (
    <div>
      <p>{message}</p>
    </div>
  );
};

export default LoginCallback;

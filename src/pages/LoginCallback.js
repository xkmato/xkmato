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
          return;
        }

        try {
          await signInWithEmailLink(auth, email, window.location.href);
          localStorage.removeItem("emailForSignIn");

          // Get the stored redirect URL or default to home
          const redirectUrl = localStorage.getItem("redirectAfterLogin");
          localStorage.removeItem("redirectAfterLogin");

          setMessage("Successfully signed in! Redirecting...");
          if (navigate) {
            // Clean up the URL by removing the sign-in link parameters
            window.history.replaceState({}, document.title, "/");
            setTimeout(() => {
              if (redirectUrl) {
                // Redirect to the stored URL
                window.location.href = redirectUrl;
              } else {
                // Fallback to home if no redirect URL is stored
                navigate("/");
              }
            }, 2000);
          }
        } catch (error) {
          console.error("Error signing in with email link:", error);
          setMessage(`Sign-in failed: ${error.message}`);
        }
      } else {
        setMessage("Invalid sign-in link.");
      }
    };
    handleSignIn();
  }, [auth, navigate]);

  return (
    <div>
      <p>{message}</p>
    </div>
  );
};

export default LoginCallback;

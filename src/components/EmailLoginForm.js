import { sendSignInLinkToEmail } from "firebase/auth";
import { useContext, useState } from "react";
import { FirebaseContext } from "../App";

const EmailLoginForm = () => {
  // Removed onLogin prop, will use FirebaseContext
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(""); // For user feedback
  const [error, setError] = useState(""); // For error messages

  const { auth } = useContext(FirebaseContext); // Get auth from context

  const actionCodeSettings = {
    url: "https://xkmato.com/login-callback", // Replace with YOUR_BLOG_LIVE_URL/login-callback
    handleCodeInApp: true,
  };

  const handleSendEmailLink = async (emailToLogin) => {
    if (!auth) {
      console.error("Firebase auth instance is not available.");
      setError(
        "Authentication service is not available. Please try again later."
      );
      return;
    }
    try {
      await sendSignInLinkToEmail(auth, emailToLogin, actionCodeSettings);
      localStorage.setItem("emailForSignIn", emailToLogin);
      setMessage(
        "A sign-in link has been sent to your email. Please check your inbox."
      );
      setError(""); // Clear previous errors
    } catch (err) {
      console.error("Error sending email link:", err);
      setError(`Failed to send link: ${err.message}`);
      setMessage(""); // Clear previous messages
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(""); // Clear previous errors
    setMessage(""); // Clear previous messages
    if (email) {
      handleSendEmailLink(email);
    } else {
      setError("Please enter your email address.");
    }
    // setEmail(""); // Keep email in input for now, user might want to see it
  };

  return (
    <div className="bg-transparent p-0">
      <form onSubmit={handleSubmit} className="flex items-center space-x-2">
        <div className="flex-grow">
          <label htmlFor="email" className="sr-only">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-transparent text-sm"
            placeholder="you@example.com"
            required
          />
        </div>
        <button
          type="submit"
          className="bg-gray-700 text-white py-1 px-3 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-500 focus:ring-opacity-50 transition duration-300 text-sm"
        >
          Send Login Link
        </button>
      </form>
      {message && (
        <p className="mt-2 text-xs text-green-600 bg-green-50 p-2 rounded-md">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded-md">
          {error}
        </p>
      )}
    </div>
  );
};

export default EmailLoginForm;

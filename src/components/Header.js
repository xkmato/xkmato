import { signOut } from "firebase/auth";
import { useContext } from "react";
import { FirebaseContext } from "../App"; // Adjust if you move FirebaseContext elsewhere
import EmailLoginForm from "./EmailLoginForm";

const Header = ({ navigate, currentPage }) => {
  const { user, userId, auth, signInWithGoogle } = useContext(FirebaseContext);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("home");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <header className="bg-white text-gray-800 p-4 shadow-sm border-b border-gray-200 text-white p-4 shadow-lg rounded-b-xl">
      <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2 sm:mb-0">
          XKMato
        </h1>
        <nav className="flex space-x-4">
          <button
            onClick={() => navigate("/")}
            className={`px-4 py-2 rounded-lg font-medium transition duration-300 ease-in-out ${
              currentPage === "home"
                ? "bg-gray-200 text-gray-800 shadow-sm"
                : "hover:bg-gray-100 text-gray-700"
            }`}
          >
            Home
          </button>
          {user && (
            <button
              onClick={() => navigate("admin")}
              className={`px-4 py-2 rounded-lg font-medium transition duration-300 ease-in-out ${
                currentPage === "admin"
                  ? "bg-gray-200 text-gray-800 shadow-sm"
                  : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              Admin
            </button>
          )}
        </nav>
        <div className="text-sm mt-2 sm:mt-0 flex items-center space-x-4">
          {user ? (
            <div className="flex items-center space-x-2">
              <span>
                Logged in as: <span className="font-semibold">{userId}</span>
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg transition duration-300 ease-in-out"
              >
                Logout
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={signInWithGoogle}
                className="bg-white text-purple-700 font-semibold px-4 py-2 rounded-lg shadow hover:bg-purple-100 transition"
              >
                Sign in with Google
              </button>
              <div className="flex items-center">
                <EmailLoginForm />
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;

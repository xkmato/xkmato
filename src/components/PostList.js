import { collection, onSnapshot, query } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import { FirebaseContext } from "../App";

// Helper to strip HTML for plain text excerpt
const stripHtml = (html) => {
  if (typeof window === "undefined" || !html) return ""; // Guard against SSR or empty html
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
  } catch (e) {
    console.error("Error stripping HTML:", e);
    return "";
  }
};

// Post List component
const PostList = ({ onSelectPost, navigate }) => {
  const { db, isAuthReady, userId } = useContext(FirebaseContext);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!db || !isAuthReady || !userId) {
      if (isAuthReady && (!db || !userId)) {
        // If auth is ready but db/userId is missing
        setLoading(false);
        // setError("Database or User ID not available."); // Optional: set an error
      }
      return;
    }

    const appId = process.env.REACT_APP_FIREBASE_APP_ID;
    if (!appId) {
      console.error("REACT_APP_FIREBASE_APP_ID is not defined.");
      setError("Application configuration error.");
      setLoading(false);
      return;
    }
    const postsCollectionPath = `artifacts/${appId}/users/${userId}/posts`;
    const postsCollectionRef = collection(db, postsCollectionPath);
    const q = query(postsCollectionRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const postsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          // Sort posts by createdAt in descending order (newest first) in memory
          postsData.sort(
            (a, b) =>
              (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0)
          );
          setPosts(postsData);
          setLoading(false);
        } catch (err) {
          console.error("Error processing posts snapshot:", err);
          setError("Failed to load posts.");
          setLoading(false);
        }
      },
      (err) => {
        console.error("onSnapshot error:", err);
        setError("Real-time updates failed.");
        setLoading(false);
      }
    );

    return () => unsubscribe(); // Cleanup listener on unmount
  }, [db, isAuthReady, userId]);

  if (loading)
    return (
      <div className="text-center text-gray-600 mt-8">Loading posts...</div>
    );
  if (error)
    return <div className="text-center text-red-500 mt-8">Error: {error}</div>;

  const featuredPost = posts.length > 0 ? posts[0] : null;
  const otherPosts = posts.slice(1);

  const getExcerpt = (content, length = 70) => {
    if (!content) return "";
    // Assuming content might be HTML, strip it for a plain text excerpt
    const text = stripHtml(content);
    return text.length > length ? text.substring(0, length) + "..." : text;
  };

  const formatDate = (timestamp) => {
    if (!timestamp?.toDate) return "";
    return new Date(timestamp.toDate())
      .toLocaleDateString("en-US", { month: "short", day: "numeric" })
      .toUpperCase();
  };

  if (posts.length === 0 && !loading)
    // Moved this check after loading/error
    return (
      <div className="text-center text-gray-600 mt-8">
        No posts yet. Start writing in the Admin panel!
      </div>
    );

  return (
    <div className="flex flex-col lg:flex-row gap-x-8 gap-y-8">
      {/* Main Content Area */}
      <div className="lg:w-2/3 flex flex-col space-y-8">
        {/* Featured Post Section */}
        {featuredPost && (
          <div
            className="bg-transparent p-0 cursor-pointer group"
            onClick={() => onSelectPost(featuredPost)}
          >
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
              {featuredPost.title}
            </h1>
            <p className="text-gray-700 text-base md:text-lg mb-3">
              {featuredPost.subtitle || "We see what we believe."}{" "}
              {/* Placeholder or use actual subtitle field */}
            </p>
            {featuredPost.createdAt && (
              <p className="text-gray-500 text-xs md:text-sm">
                {formatDate(featuredPost.createdAt)} • XKMATO{" "}
                {/* Assuming author is XKMATO */}
              </p>
            )}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-gray-300 pb-2">
          <button className="py-2 px-3 text-sm font-semibold text-gray-900 border-b-2 border-gray-900">
            Latest
          </button>
          <button className="py-2 px-3 text-sm font-medium text-gray-600 hover:text-gray-900">
            Top
          </button>
          <button className="py-2 px-3 text-sm font-medium text-gray-600 hover:text-gray-900">
            Discussions
          </button>
        </div>

        {/* List of Other Posts */}
        <div className="space-y-6">
          {otherPosts.map((post) => (
            <div
              key={post.id}
              className="flex bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden cursor-pointer border border-gray-200 group"
              onClick={() => onSelectPost(post)}
            >
              <div className="p-4 sm:p-5 flex-grow">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-1 group-hover:text-blue-600 transition-colors">
                  {post.title}
                </h2>
                <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                  {post.subtitle || getExcerpt(post.content)}
                </p>
                {post.createdAt && (
                  <p className="text-gray-500 text-xs mt-1">
                    {formatDate(post.createdAt)} • XKMATO{" "}
                    {/* Assuming author is XKMATO */}
                  </p>
                )}
              </div>
              {post.imageUrl && (
                <div className="w-1/3 sm:w-32 md:w-40 lg:w-48 flex-shrink-0">
                  {" "}
                  {/* Fixed width for image container */}
                  <img
                    src={post.imageUrl}
                    alt={post.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `https://placehold.co/200x150/E0E0E0/333333?text=Image`;
                    }}
                  />
                </div>
              )}
            </div>
          ))}
          {otherPosts.length === 0 && featuredPost && (
            <div className="text-center text-gray-600 py-4">No more posts.</div>
          )}
        </div>
      </div>

      {/* Sidebar Area */}
      <aside className="lg:w-1/3 space-y-6 lg:pt-0">
        {" "}
        {/* Adjusted padding for consistency */}
        <div className="p-5 sm:p-6 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-indigo-100 mr-3 sm:mr-4 flex items-center justify-center overflow-hidden">
              <img
                src="https://placehold.co/48x48/7C3AED/FFFFFF?text=X&font=inter"
                alt="xkmato avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-800">
                xkmato
              </h3>
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Welcome to xkmato — a space where I think out loud, explore the
            nature of our reality, share hard-earned knowledge, and take
            creative swings within my reach.
          </p>
          <button className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-300 ease-in-out flex items-center justify-center text-sm sm:text-base">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 sm:w-5 sm:h-5 mr-2"
            >
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                clipRule="evenodd"
              />
            </svg>
            Subscribed
          </button>
        </div>
      </aside>
    </div>
  );
};

export default PostList;

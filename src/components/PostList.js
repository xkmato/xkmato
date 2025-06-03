import { collection, onSnapshot, query } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import { FirebaseContext } from "../App";

// Post List component
const PostList = ({ onSelectPost, navigate }) => {
  const { db, isAuthReady, userId } = useContext(FirebaseContext);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!db || !isAuthReady || !userId) return;

    const appId = process.env.REACT_APP_FIREBASE_APP_ID;
    const postsCollectionRef = collection(
      db,
      `artifacts/${appId}/users/${userId}/posts`
    );
    const q = query(postsCollectionRef); // No orderBy here as per instructions

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
              (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0)
          );
          setPosts(postsData);
          setLoading(false);
        } catch (err) {
          console.error("Error fetching posts:", err);
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
  if (posts.length === 0)
    return (
      <div className="text-center text-gray-600 mt-8">
        No posts yet. Start writing in the Admin panel!
      </div>
    );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
      {posts.map((post) => (
        <div
          key={post.id}
          className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden cursor-pointer border border-gray-100"
          onClick={() => onSelectPost(post)}
        >
          {post.imageUrl && (
            <img
              src={post.imageUrl}
              alt={post.title}
              className="w-full h-48 object-cover rounded-t-xl"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = `https://placehold.co/600x400/E0E0E0/333333?text=Image+Unavailable`;
              }}
            />
          )}
          <div className="p-5">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {post.title}
            </h2>
            <p className="text-gray-600 text-sm mb-3 line-clamp-3">
              {post.content}
            </p>
            {post.createdAt && (
              <p className="text-gray-500 text-xs mt-2">
                Published:{" "}
                {new Date(post.createdAt.toDate()).toLocaleDateString()}
              </p>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectPost(post);
              }} // Prevent parent div click
              className="mt-4 bg-gray-800 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
            >
              Read More
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PostList;

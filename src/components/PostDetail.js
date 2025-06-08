import { ChatBubbleOvalLeftIcon, HeartIcon } from "@heroicons/react/24/outline";
import {
  getAuth,
  GoogleAuthProvider,
  sendSignInLinkToEmail,
  signInWithPopup,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  collection as fsCollection,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { useContext, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { FirebaseContext } from "../App";
import SEOHead from "./SEOHead";

const PostDetail = ({ onBack }) => {
  const { db, user } = useContext(FirebaseContext); // Ensure user is provided in context
  const { userId, postId } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showShare, setShowShare] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([]);
  const [commentLoading, setCommentLoading] = useState(true);
  const [commentError, setCommentError] = useState(null);
  const shareUrl = window.location.href;
  const shareTitle = post?.title || "Check out this post!";

  // Optional: Close popup when clicking outside
  const shareRef = useRef();
  useEffect(() => {
    function handleClickOutside(event) {
      if (shareRef.current && !shareRef.current.contains(event.target)) {
        setShowShare(false);
      }
    }
    if (showShare) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showShare]);

  useEffect(() => {
    if (!db || !userId || !postId) return;
    const appId = process.env.REACT_APP_FIREBASE_APP_ID;
    const postRef = doc(
      db,
      `artifacts/${appId}/users/${userId}/posts/${postId}`
    );
    getDoc(postRef)
      .then((docSnap) => {
        if (docSnap.exists()) {
          setPost({ id: docSnap.id, ...docSnap.data() });
        } else {
          setError("Post not found");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load post");
        setLoading(false);
      });
  }, [db, userId, postId]);

  // Fetch like count and whether current user liked
  useEffect(() => {
    if (!db || !userId || !postId) return;
    const likesCol = collection(
      db,
      `artifacts/${process.env.REACT_APP_FIREBASE_APP_ID}/users/${userId}/posts/${postId}/likes`
    );
    getDoc(doc(likesCol, user?.uid || "dummy")).then((docSnap) => {
      setLiked(!!user && docSnap.exists());
    });
    // Count likes
    import("firebase/firestore").then(({ getCountFromServer }) => {
      getCountFromServer(likesCol).then((snap) =>
        setLikeCount(snap.data().count)
      );
    });
  }, [db, userId, postId, user]);

  // Like/unlike handler
  const handleLike = async () => {
    if (!user) {
      setShowLogin(true);
      return;
    }
    const likesCol = collection(
      db,
      `artifacts/${process.env.REACT_APP_FIREBASE_APP_ID}/users/${userId}/posts/${postId}/likes`
    );
    const likeDoc = doc(likesCol, user.uid);
    if (liked) {
      await deleteDoc(likeDoc);
      setLiked(false);
      setLikeCount((c) => c - 1);
    } else {
      await setDoc(likeDoc, { likedAt: new Date() });
      setLiked(true);
      setLikeCount((c) => c + 1);
    }
  };

  // Google login
  const handleGoogleLogin = async () => {
    const auth = getAuth();
    await signInWithPopup(auth, new GoogleAuthProvider());
    setShowLogin(false);
  };

  // Email magic link login
  const handleEmailMagicLink = async () => {
    const email = prompt("Enter your email for magic link:");
    if (!email) return;
    const auth = getAuth();
    await sendSignInLinkToEmail(auth, email, {
      url: window.location.href,
      handleCodeInApp: true,
    });
    alert("Check your email for the magic link!");
    setShowLogin(false);
  };

  // Fetch comments in real-time
  useEffect(() => {
    if (!db || !userId || !postId) return;
    setCommentLoading(true);
    setCommentError(null);
    const commentsCol = fsCollection(
      db,
      `artifacts/${process.env.REACT_APP_FIREBASE_APP_ID}/users/${userId}/posts/${postId}/comments`
    );
    const q = query(commentsCol, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setComments(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setCommentLoading(false);
      },
      (err) => {
        setCommentError("Failed to load comments");
        setCommentLoading(false);
      }
    );
    return () => unsub();
  }, [db, userId, postId]);

  // Handle comment submit
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!user || !commentText.trim()) return;
    const commentsCol = fsCollection(
      db,
      `artifacts/${process.env.REACT_APP_FIREBASE_APP_ID}/users/${userId}/posts/${postId}/comments`
    );
    await addDoc(commentsCol, {
      text: commentText.trim(),
      createdAt: new Date(),
      authorId: user.uid,
      authorName: user.displayName || "Anonymous",
      authorImageUrl: user.photoURL || "",
    });
    setCommentText("");
  };

  // Helper function to extract first image URL from HTML content
  const extractFirstImageFromContent = (htmlContent) => {
    if (!htmlContent) return null;

    // Create a temporary div to parse HTML
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;

    // Look for img tags
    const imgTag = tempDiv.querySelector("img");
    if (imgTag && imgTag.src) {
      return imgTag.src;
    }

    // Look for image URLs in text (basic regex for common image extensions)
    const imageUrlRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|svg))/i;
    const match = htmlContent.match(imageUrlRegex);

    return match ? match[1] : null;
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;
  if (!post) return null;

  const publicationDate = post.createdAt
    ? new Date(post.createdAt.toDate())
        .toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
        .toUpperCase()
    : "";

  // Determine SEO image with fallback logic
  const getSEOImage = () => {
    // 1. Use featured image if available
    if (post.imageUrl) {
      return post.imageUrl;
    }

    // 2. Extract first image from content
    const contentImage = extractFirstImageFromContent(post.content);
    if (contentImage) {
      return contentImage;
    }

    // 3. Fall back to org image from environment or default
    return (
      process.env.REACT_APP_DEFAULT_OG_IMAGE ||
      "https://xkmato.com/og-image.png"
    );
  };

  return (
    <>
      {post && (
        <SEOHead
          title={post.title}
          description={post.content?.substring(0, 160) + "..."}
          image={getSEOImage()}
          url={`https://xkmato.com/post/${post.userId}/${post.id}`}
          type="article"
          publishedTime={
            post.createdAt?.toDate
              ? post.createdAt.toDate().toISOString()
              : null
          }
        />
      )}
      <div className="mx-auto max-w-3xl p-6 bg-white rounded-xl shadow-md mt-8 border border-gray-100">
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:underline mb-4"
        >
          &larr; Back
        </button>

        {/* Draft indicator for author */}
        {post.isDraft && user?.uid === userId && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-yellow-600 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-yellow-800 font-medium">
                This post is in draft mode
              </span>
            </div>
            <p className="text-yellow-700 text-sm mt-1">
              Only you can see this post. Publish it to make it visible to
              everyone.
            </p>
          </div>
        )}

        <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
          {post.title}
        </h1>

        {post.subtitle && (
          <p className="text-xl text-gray-600 mb-6">{post.subtitle}</p>
        )}

        {/* Author and date row */}
        <div className="flex items-center mb-4">
          {post.authorImageUrl && (
            <img
              src={post.authorImageUrl}
              alt={post.authorName || "Author"}
              className="w-10 h-10 rounded-full mr-3 object-cover"
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = "none";
              }}
            />
          )}
          <div>
            {post.authorName && (
              <p className="text-xs font-semibold text-gray-800 tracking-widest uppercase leading-tight">
                {post.authorName}
              </p>
            )}
            {publicationDate && (
              <p className="text-xs text-gray-500">{publicationDate}</p>
            )}
          </div>
        </div>

        {/* Action icons row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              className={`group flex items-center ${
                liked ? "text-red-500" : ""
              }`}
              aria-label="Like"
              onClick={handleLike}
            >
              <HeartIcon
                className={`w-6 h-6 ${
                  liked ? "text-red-500" : "text-gray-400"
                } group-hover:text-red-500 transition`}
              />
            </button>
            <span className="ml-2 text-gray-500 text-sm font-medium">
              {likeCount}
            </span>
            <button className="group flex items-center" aria-label="Comment">
              <ChatBubbleOvalLeftIcon className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="border border-gray-300 rounded-full px-4 py-1 text-gray-700 text-sm font-medium hover:bg-gray-100 transition"
              onClick={() => setShowShare(true)}
            >
              Share
            </button>
          </div>
        </div>

        {/* Share Popup */}
        {showShare && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div
              ref={shareRef}
              className="bg-white rounded-2xl shadow-2xl p-8 min-w-[300px] flex flex-col gap-4 border border-gray-100 relative"
            >
              <button
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 transition"
                onClick={() => setShowShare(false)}
                aria-label="Close"
              >
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
                  <path
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    d="M6 6l12 12M6 18L18 6"
                  />
                </svg>
              </button>
              <h3 className="text-xl font-bold mb-2 text-center text-gray-800">
                Share this post
              </h3>
              <div className="flex flex-col gap-3">
                <a
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(
                    shareUrl
                  )}&text=${encodeURIComponent(shareTitle)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 transition text-blue-600 font-medium"
                >
                  {/* Twitter Icon */}
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M22.46 5.924c-.793.352-1.646.59-2.542.698a4.48 4.48 0 001.964-2.475 8.94 8.94 0 01-2.828 1.082 4.48 4.48 0 00-7.636 4.086A12.72 12.72 0 013.15 4.897a4.48 4.48 0 001.39 5.976 4.44 4.44 0 01-2.03-.561v.057a4.48 4.48 0 003.594 4.393 4.48 4.48 0 01-2.025.077 4.48 4.48 0 004.184 3.114A8.98 8.98 0 012 19.54a12.67 12.67 0 006.88 2.017c8.26 0 12.78-6.84 12.78-12.78 0-.195-.004-.39-.013-.583a9.13 9.13 0 002.24-2.33z" />
                  </svg>
                  Share on Twitter
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                    shareUrl
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-100 hover:bg-blue-200 transition text-blue-800 font-medium"
                >
                  {/* Facebook Icon */}
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M22.675 0h-21.35C.595 0 0 .592 0 1.326v21.348C0 23.408.595 24 1.325 24H12.82v-9.294H9.692v-3.622h3.127V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.797.143v3.24l-1.918.001c-1.504 0-1.797.715-1.797 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116C23.406 24 24 23.408 24 22.674V1.326C24 .592 23.406 0 22.675 0" />
                  </svg>
                  Share on Facebook
                </a>
                <a
                  href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(
                    shareUrl
                  )}&title=${encodeURIComponent(shareTitle)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 hover:bg-blue-200 transition text-blue-900 font-medium"
                >
                  {/* LinkedIn Icon */}
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M19 0h-14c-2.76 0-5 2.24-5 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5v-14c0-2.76-2.24-5-5-5zm-11.75 20h-3v-10h3v10zm-1.5-11.27c-.97 0-1.75-.79-1.75-1.76s.78-1.76 1.75-1.76 1.75.79 1.75 1.76-.78 1.76-1.75 1.76zm15.25 11.27h-3v-5.6c0-1.34-.03-3.07-1.87-3.07-1.87 0-2.16 1.46-2.16 2.97v5.7h-3v-10h2.88v1.36h.04c.4-.75 1.38-1.54 2.84-1.54 3.04 0 3.6 2 3.6 4.59v5.59z" />
                  </svg>
                  Share on LinkedIn
                </a>
                <button
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition text-gray-700 font-medium"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      alert("Link copied to clipboard!");
                    } catch (err) {
                      alert("Failed to copy link.");
                    }
                  }}
                >
                  {/* Link Icon */}
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M10 13a5 5 0 007.07 0l1.41-1.41a5 5 0 00-7.07-7.07l-1.41 1.41" />
                    <path d="M14 11a5 5 0 01-7.07 0l-1.41-1.41a5 5 0 017.07-7.07l1.41 1.41" />
                  </svg>
                  Copy Link
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Login Popup */}
        {showLogin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-2xl shadow-2xl p-8 min-w-[300px] flex flex-col gap-4 border border-gray-100 relative">
              <button
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 transition"
                onClick={() => setShowLogin(false)}
                aria-label="Close"
              >
                ×
              </button>
              <h3 className="text-xl font-bold mb-2 text-center text-gray-800">
                Log in to like posts
              </h3>
              <button
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold mb-2"
                onClick={handleGoogleLogin}
              >
                Continue with Google
              </button>
              <button
                className="w-full bg-gray-100 text-gray-800 py-2 rounded-lg font-semibold"
                onClick={handleEmailMagicLink}
              >
                Email Magic Link
              </button>
            </div>
          </div>
        )}

        {/* Divider */}
        <hr className="mb-6 border-gray-200" />

        {post.imageUrl && (
          <img
            src={post.imageUrl}
            alt={post.title}
            className="w-full h-auto max-h-[600px] object-cover rounded-lg mb-6"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = `https://placehold.co/800x400/E0E0E0/333333?text=Image+Unavailable`;
            }}
          />
        )}

        <div
          className="prose max-w-none text-gray-700 leading-relaxed"
          style={{ whiteSpace: "pre-wrap" }}
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Divider */}
        <hr className="mb-6 border-gray-200" />

        {/* Comments Section */}
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-2">Comments</h2>
          {commentLoading && (
            <div className="text-gray-500 text-sm">Loading comments...</div>
          )}
          {commentError && (
            <div className="text-red-500 text-sm">{commentError}</div>
          )}
          {comments.length === 0 && !commentLoading && (
            <div className="text-gray-400 text-sm">No comments yet.</div>
          )}
          <ul className="space-y-4 mb-4">
            {comments.map((c) => (
              <li key={c.id} className="flex items-start gap-3">
                {c.authorImageUrl && (
                  <img
                    src={c.authorImageUrl}
                    alt={c.authorName}
                    className="w-8 h-8 rounded-full object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = "none";
                    }}
                  />
                )}
                <div>
                  <div className="text-xs font-semibold text-gray-700">
                    {c.authorName}
                  </div>
                  <div className="text-sm text-gray-800">{c.text}</div>
                  <div className="text-xs text-gray-400">
                    {c.createdAt?.toDate
                      ? new Date(c.createdAt.toDate()).toLocaleString()
                      : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {user ? (
            <form onSubmit={handleCommentSubmit} className="flex gap-2">
              <input
                type="text"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                maxLength={500}
                required
              />
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
                disabled={!commentText.trim()}
              >
                Post
              </button>
            </form>
          ) : (
            <div className="text-gray-500 text-sm">
              <button className="underline" onClick={() => setShowLogin(true)}>
                Log in
              </button>{" "}
              to comment.
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PostDetail;

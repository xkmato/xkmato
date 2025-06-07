import {
  getAuth,
  GoogleAuthProvider,
  sendSignInLinkToEmail,
  signInWithPopup,
} from "firebase/auth";
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
} from "firebase/firestore";
import { useContext, useEffect, useRef, useState } from "react";
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
  const { db, isAuthReady, user, app } = useContext(FirebaseContext);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("Latest");
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [allPosts, setAllPosts] = useState([]); // Store all posts for real-time updates
  const emailRef = useRef();

  const POSTS_PER_PAGE = 15;

  // Google Sign-In handler
  const handleGoogleSignIn = async () => {
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      alert("Google sign-in failed: " + err.message);
    }
  };

  // Email link sign-in handler
  const handleSendLoginLink = async (e) => {
    e.preventDefault();
    const auth = getAuth(app);
    const email = emailRef.current.value;
    const actionCodeSettings = {
      url: window.location.href,
      handleCodeInApp: true,
    };
    try {
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem("emailForSignIn", email);
      alert("Login link sent! Check your email.");
    } catch (err) {
      alert("Failed to send login link: " + err.message);
    }
  };

  // Load more posts function - updated to handle tab filtering
  const loadMorePosts = async () => {
    if (!db || !hasMore || loadingMore) return;

    setLoadingMore(true);
    try {
      const appId = process.env.REACT_APP_FIREBASE_APP_ID;
      const postsCollectionPath = `artifacts/${appId}/users/${process.env.REACT_APP_ADMIN_USER_UID}/posts`;
      const postsCollectionRef = collection(db, postsCollectionPath);

      // For "Latest" tab, use normal pagination
      if (activeTab === "Latest") {
        let q = query(
          postsCollectionRef,
          orderBy("createdAt", "desc"),
          limit(POSTS_PER_PAGE)
        );

        if (lastDoc) {
          q = query(
            postsCollectionRef,
            orderBy("createdAt", "desc"),
            startAfter(lastDoc),
            limit(POSTS_PER_PAGE)
          );
        }

        const snapshot = await getDocs(q);

        if (snapshot.empty || snapshot.docs.length < POSTS_PER_PAGE) {
          setHasMore(false);
        }

        const newPosts = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const filteredNewPosts = newPosts.filter((post) => {
          if (user?.uid === process.env.REACT_APP_ADMIN_USER_UID) {
            return true;
          }
          return !post.isDraft;
        });

        setPosts((prevPosts) => [...prevPosts, ...filteredNewPosts]);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      } else {
        // For other tabs, use allPosts and implement client-side pagination
        const currentPostCount = posts.length;
        const nextBatchSize = POSTS_PER_PAGE;

        let filteredAllPosts;

        if (activeTab === "Top") {
          filteredAllPosts = [...allPosts].sort(
            (a, b) => (b.views || 0) - (a.views || 0)
          );
        } else if (activeTab === "Others") {
          const topTags = getTopTags();
          filteredAllPosts = allPosts.filter((post) => {
            if (!post.tags || !Array.isArray(post.tags)) return true;

            const postTagKeys = post.tags.map(
              (tag) => `${tag.categoryName}:${tag.name}`
            );
            const topTagKeys = topTags.map(
              (tag) => `${tag.categoryName}:${tag.name}`
            );

            return !postTagKeys.some((key) => topTagKeys.includes(key));
          });
        } else {
          // Specific tag filter
          const topTags = getTopTags();
          const selectedTag = topTags.find(
            (tag) => tag.displayName === activeTab
          );
          if (!selectedTag) {
            setHasMore(false);
            setLoadingMore(false);
            return;
          }

          filteredAllPosts = allPosts.filter((post) => {
            if (!post.tags || !Array.isArray(post.tags)) return false;
            return post.tags.some(
              (tag) =>
                tag.categoryName === selectedTag.categoryName &&
                tag.name === selectedTag.name
            );
          });
        }

        // Get the next batch of posts
        const nextBatch = filteredAllPosts.slice(
          currentPostCount,
          currentPostCount + nextBatchSize
        );

        if (nextBatch.length === 0 || nextBatch.length < nextBatchSize) {
          setHasMore(false);
        }

        if (nextBatch.length > 0) {
          setPosts((prevPosts) => [...prevPosts, ...nextBatch]);
        }
      }
    } catch (err) {
      console.error("Error loading more posts:", err);
      setError("Failed to load more posts.");
    } finally {
      setLoadingMore(false);
    }
  };

  // Initial load and real-time updates for new posts
  useEffect(() => {
    if (!db || !isAuthReady) {
      if (isAuthReady && !db) {
        setLoading(false);
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

    const postsCollectionPath = `artifacts/${appId}/users/${process.env.REACT_APP_ADMIN_USER_UID}/posts`;
    const postsCollectionRef = collection(db, postsCollectionPath);

    // Initial load - get first batch of posts
    const initialQuery = query(
      postsCollectionRef,
      orderBy("createdAt", "desc"),
      limit(POSTS_PER_PAGE)
    );

    // Set up real-time listener for all posts (for new posts detection)
    const allPostsQuery = query(postsCollectionRef);
    const unsubscribeAll = onSnapshot(allPostsQuery, (snapshot) => {
      const allPostsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const filteredAllPosts = allPostsData.filter((post) => {
        if (user?.uid === process.env.REACT_APP_ADMIN_USER_UID) {
          return true;
        }
        return !post.isDraft;
      });

      filteredAllPosts.sort(
        (a, b) =>
          (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0)
      );

      setAllPosts(filteredAllPosts);
    });

    // Initial load
    getDocs(initialQuery)
      .then((snapshot) => {
        try {
          if (snapshot.empty) {
            setHasMore(false);
          } else if (snapshot.docs.length < POSTS_PER_PAGE) {
            setHasMore(false);
          }

          const postsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          const filteredPosts = postsData.filter((post) => {
            if (user?.uid === process.env.REACT_APP_ADMIN_USER_UID) {
              return true;
            }
            return !post.isDraft;
          });

          setPosts(filteredPosts);
          setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
          setLoading(false);
        } catch (err) {
          console.error("Error processing initial posts:", err);
          setError("Failed to load posts.");
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error loading initial posts:", err);
        setError("Failed to load posts.");
        setLoading(false);
      });

    return () => unsubscribeAll();
  }, [db, isAuthReady, user]);

  // Reset pagination when tab changes - updated to handle initial load properly
  useEffect(() => {
    setPosts([]);
    setLastDoc(null);
    setHasMore(true);
    setLoading(true);

    // For "Latest" tab, reload from database
    if (activeTab === "Latest" && db && isAuthReady) {
      loadMorePosts();
    }
    // For other tabs, use allPosts for initial load
    else if (activeTab !== "Latest" && allPosts.length > 0) {
      const initialBatchSize = POSTS_PER_PAGE;
      let filteredPosts;

      if (activeTab === "Top") {
        filteredPosts = [...allPosts].sort(
          (a, b) => (b.views || 0) - (a.views || 0)
        );
      } else if (activeTab === "Others") {
        const topTags = getTopTags();
        filteredPosts = allPosts.filter((post) => {
          if (!post.tags || !Array.isArray(post.tags)) return true;

          const postTagKeys = post.tags.map(
            (tag) => `${tag.categoryName}:${tag.name}`
          );
          const topTagKeys = topTags.map(
            (tag) => `${tag.categoryName}:${tag.name}`
          );

          return !postTagKeys.some((key) => topTagKeys.includes(key));
        });
      } else {
        // Specific tag filter
        const topTags = getTopTags();
        const selectedTag = topTags.find(
          (tag) => tag.displayName === activeTab
        );
        if (selectedTag) {
          filteredPosts = allPosts.filter((post) => {
            if (!post.tags || !Array.isArray(post.tags)) return false;
            return post.tags.some(
              (tag) =>
                tag.categoryName === selectedTag.categoryName &&
                tag.name === selectedTag.name
            );
          });
        } else {
          filteredPosts = [];
        }
      }

      const initialBatch = filteredPosts.slice(0, initialBatchSize);
      setPosts(initialBatch);

      if (filteredPosts.length <= initialBatchSize) {
        setHasMore(false);
      }

      setLoading(false);
    }
  }, [activeTab, allPosts, db, isAuthReady]);

  // Get unique tags from all posts (use allPosts for complete tag list)
  const getTopTags = () => {
    const tagCounts = {};

    allPosts.forEach((post) => {
      if (user?.uid !== process.env.REACT_APP_ADMIN_USER_UID && post.isDraft) {
        return;
      }

      if (post.tags && Array.isArray(post.tags)) {
        post.tags.forEach((tag) => {
          const key = `${tag.categoryName}:${tag.name}`;
          tagCounts[key] = (tagCounts[key] || 0) + 1;
        });
      }
    });

    const bookTags = [];
    const otherTags = [];

    Object.entries(tagCounts).forEach(([tagKey, count]) => {
      const [categoryName, tagName] = tagKey.split(":");
      const tagData = {
        categoryName,
        name: tagName,
        displayName: `${tagName} (${categoryName})`,
        count,
      };

      if (categoryName === "Book") {
        bookTags.push(tagData);
      } else {
        otherTags.push(tagData);
      }
    });

    bookTags.sort((a, b) => b.count - a.count);
    otherTags.sort((a, b) => b.count - a.count);

    const result = [...bookTags.slice(0, 5)];
    const remainingSlots = 5 - result.length;

    if (remainingSlots > 0) {
      result.push(...otherTags.slice(0, remainingSlots));
    }

    return result;
  };

  const topTags = getTopTags();

  // Filter posts based on active tab
  const getFilteredPosts = () => {
    return posts;
  };

  const filteredPosts = getFilteredPosts();
  const featuredPost = filteredPosts.length > 0 ? filteredPosts[0] : null;
  const otherPosts = filteredPosts.slice(1);

  const getExcerpt = (content, length = 70) => {
    if (!content) return "";
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
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                {featuredPost.title}
              </h1>
              {featuredPost.isDraft &&
                user?.uid === process.env.REACT_APP_ADMIN_USER_UID && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                    Draft
                  </span>
                )}
            </div>
            <p className="text-gray-700 text-base md:text-lg mb-3">
              {featuredPost.subtitle || "We see what we believe."}
            </p>
            {featuredPost.createdAt && (
              <p className="text-gray-500 text-xs md:text-sm">
                {formatDate(featuredPost.createdAt)} • XKMATO
              </p>
            )}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-gray-300 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("Latest")}
            className={`py-2 px-3 text-sm font-medium whitespace-nowrap ${
              activeTab === "Latest"
                ? "font-semibold text-gray-900 border-b-2 border-gray-900"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Latest
          </button>

          <button
            onClick={() => setActiveTab("Top")}
            className={`py-2 px-3 text-sm font-medium whitespace-nowrap ${
              activeTab === "Top"
                ? "font-semibold text-gray-900 border-b-2 border-gray-900"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Top
          </button>

          {/* Dynamic Top 5 Tags */}
          {topTags.map((tag) => (
            <button
              key={tag.displayName}
              onClick={() => setActiveTab(tag.displayName)}
              className={`py-2 px-3 text-sm font-medium whitespace-nowrap ${
                activeTab === tag.displayName
                  ? "font-semibold text-gray-900 border-b-2 border-gray-900"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tag.displayName}
            </button>
          ))}

          <button
            onClick={() => setActiveTab("Others")}
            className={`py-2 px-3 text-sm font-medium whitespace-nowrap ${
              activeTab === "Others"
                ? "font-semibold text-gray-900 border-b-2 border-gray-900"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Others
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
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                    {post.title}
                  </h2>
                  {post.isDraft &&
                    user?.uid === process.env.REACT_APP_ADMIN_USER_UID && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Draft
                      </span>
                    )}
                </div>
                <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                  {post.subtitle || getExcerpt(post.content)}
                </p>
                {post.createdAt && (
                  <p className="text-gray-500 text-xs mt-1">
                    {formatDate(post.createdAt)} • XKMATO
                  </p>
                )}
              </div>
              {post.imageUrl && (
                <div className="w-1/3 sm:w-32 md:w-40 lg:w-48 flex-shrink-0">
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

          {/* Load More Button */}
          {hasMore && filteredPosts.length >= POSTS_PER_PAGE && (
            <div className="text-center py-6">
              <button
                onClick={loadMorePosts}
                disabled={loadingMore}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium py-3 px-6 rounded-lg transition duration-300 ease-in-out"
              >
                {loadingMore ? "Loading..." : "Load More Posts"}
              </button>
            </div>
          )}

          {otherPosts.length === 0 && featuredPost && !hasMore && (
            <div className="text-center text-gray-600 py-4">No more posts.</div>
          )}
        </div>
      </div>

      {/* Sidebar Area - keeping existing sidebar code */}
      <aside className="lg:w-1/3 space-y-6 lg:pt-0">
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
          {user ? (
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
          ) : (
            <div className="space-y-3">
              <button
                onClick={handleGoogleSignIn}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-300 ease-in-out flex items-center justify-center text-sm sm:text-base"
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 48 48">
                  <g>
                    <path
                      fill="#4285F4"
                      d="M44.5 20H24v8.5h11.7C34.8 33.1 30.1 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8.1 2.9l6.1-6.1C34.5 6.5 29.6 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5c11.3 0 20.5-9.2 20.5-20.5 0-1.4-.1-2.7-.3-4z"
                    />
                    <path
                      fill="#34A853"
                      d="M6.3 14.7l7 5.1C15.3 16.1 19.3 13.5 24 13.5c3.1 0 5.9 1.1 8.1 2.9l6.1-6.1C34.5 6.5 29.6 4.5 24 4.5c-7.2 0-13.3 4.1-16.7 10.2z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M24 45.5c5.6 0 10.5-1.9 14.4-5.1l-6.7-5.5c-2 1.4-4.6 2.2-7.7 2.2-6.1 0-11.2-4.1-13-9.6l-7 5.4C6.7 41.1 14.7 45.5 24 45.5z"
                    />
                    <path
                      fill="#EA4335"
                      d="M44.5 20H24v8.5h11.7c-1.2 3.2-4.1 5.5-7.7 5.5-4.6 0-8.4-3.8-8.4-8.5s3.8-8.5 8.4-8.5c2.5 0 4.7.9 6.3 2.4l6.1-6.1C38.1 10.1 31.6 7.5 24 7.5c-8.7 0-16.1 5.9-18.7 14.2l7 5.1C15.3 16.1 19.3 13.5 24 13.5c3.1 0 5.9 1.1 8.1 2.9l6.1-6.1C34.5 6.5 29.6 4.5 24 4.5z"
                    />
                  </g>
                </svg>
                Sign in with Google
              </button>
              <form
                onSubmit={handleSendLoginLink}
                className="flex flex-col gap-2"
              >
                <input
                  ref={emailRef}
                  type="email"
                  required
                  placeholder="Email for login link"
                  className="border border-gray-300 rounded px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 rounded-lg transition duration-300 ease-in-out text-sm"
                >
                  Send Login Link
                </button>
              </form>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

export default PostList;

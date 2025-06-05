import { logEvent } from "firebase/analytics";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
} from "firebase/firestore";
import {
  ref as firebaseStorageRef,
  getDownloadURL,
  getStorage,
  uploadBytesResumable,
} from "firebase/storage"; // Firebase Storage imports
import { useContext, useEffect, useRef, useState } from "react"; // Added useRef
import ReactQuill from "react-quill-new"; // Import ReactQuill
import "react-quill-new/dist/quill.snow.css"; // Import Quill's CSS
import { FirebaseContext, analytics, app } from "../App";

const appId = process.env.REACT_APP_FIREBASE_APP_ID;

const AdminPanel = () => {
  const { db, user, userId, isAuthReady } = useContext(FirebaseContext); // Ensure 'storage' is provided by FirebaseContext
  // If 'storage' is not in FirebaseContext, you might initialize it:
  const storage = getStorage(app); // Make sure your Firebase app is initialized

  const [posts, setPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true); // For general loading like fetching/saving posts
  const [imageUploading, setImageUploading] = useState(false); // Specific state for image uploads
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [postToDelete, setPostToDelete] = useState(null);
  const quillRef = useRef(null); // Ref for ReactQuill component

  useEffect(() => {
    if (!db || !isAuthReady || !user || !userId) return;
    logEvent(analytics, "admin_panel_opened");
    const postsCollectionRef = collection(
      db,
      `artifacts/${appId}/users/${userId}/posts`
    );
    const q = query(postsCollectionRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const postsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          postsData.sort(
            (a, b) =>
              (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0)
          );
          setPosts(postsData);
          setLoading(false);
        } catch (err) {
          console.error("Error fetching posts for admin:", err);
          setMessage("Failed to load posts for admin.");
          setLoading(false);
        }
      },
      (err) => {
        console.error("onSnapshot error for admin:", err);
        setMessage("Real-time updates failed for admin.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db, user, userId, isAuthReady]);

  const resetForm = () => {
    setSelectedPost(null);
    setFormTitle("");
    setFormContent("");
    setMessage("");
  };

  // Custom Image Handler for ReactQuill
  const imageHandler = () => {
    if (!storage) {
      setMessage("Firebase Storage is not initialized. Cannot upload image.");
      // Potentially show a modal or a more persistent error
      return;
    }
    if (!userId) {
      setMessage("User not authenticated. Cannot upload image.");
      return;
    }
    if (!quillRef.current) {
      setMessage("Editor not ready. Please try again.");
      return;
    }

    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();

    input.onchange = async () => {
      const file = input.files[0];
      if (!file) {
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        // Example: 5MB limit for individual images
        setMessage("Image file is too large. Maximum 5MB allowed per image.");
        return;
      }

      setImageUploading(true);
      setMessage("Uploading image...");

      const imagePath = `users/${userId}/images/${Date.now()}_${file.name}`;
      const imageRef = firebaseStorageRef(storage, imagePath);
      const uploadTask = uploadBytesResumable(imageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setMessage(`Uploading image: ${Math.round(progress)}%`);
        },
        (error) => {
          console.error("Image upload error:", error);
          setMessage(
            `Image upload failed: ${error.message}. Ensure storage rules allow writes.`
          );
          setImageUploading(false);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref)
            .then((downloadURL) => {
              const editor = quillRef.current.getEditor();
              const range = editor.getSelection(true); // Get current cursor position or default to end
              editor.insertEmbed(range.index, "image", downloadURL);
              editor.setSelection(range.index + 1); // Move cursor after the inserted image
              setMessage("Image uploaded and inserted successfully!");
              setImageUploading(false);
            })
            .catch((error) => {
              console.error("Error getting download URL:", error);
              setMessage(
                `Error retrieving image URL after upload: ${error.message}`
              );
              setImageUploading(false);
            });
        }
      );
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (imageUploading) {
      setMessage("Please wait for the image to finish uploading.");
      return;
    }
    if (!db || !user || !userId) {
      setMessage("Authentication required to save posts.");
      return;
    }

    if (!formTitle || !formContent) {
      setMessage("Title and Content cannot be empty.");
      return;
    }

    const contentByteLength = new TextEncoder().encode(formContent).length;
    const MAX_FIRESTORE_FIELD_BYTES = 1048487; // Approx 1MB

    if (contentByteLength > MAX_FIRESTORE_FIELD_BYTES) {
      const currentSizeKB = Math.round(contentByteLength / 1024);
      const maxSizeKB = Math.round(MAX_FIRESTORE_FIELD_BYTES / 1024);
      setMessage(
        `Error: Post content is too large (${currentSizeKB}KB). The maximum size is ~${maxSizeKB}KB. Images are stored separately, but the text and image links must fit this limit.`
      );
      return;
    }

    setLoading(true);
    setMessage(selectedPost ? "Updating post..." : "Creating post...");

    try {
      if (selectedPost) {
        const postRef = doc(
          db,
          `artifacts/${appId}/users/${userId}/posts`,
          selectedPost.id
        );
        await updateDoc(postRef, {
          title: formTitle,
          content: formContent,
          updatedAt: new Date(),
        });
        setMessage("Post updated successfully!");
      } else {
        await addDoc(
          collection(db, `artifacts/${appId}/users/${userId}/posts`),
          {
            title: formTitle,
            content: formContent,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        );
        setMessage("Post created successfully!");
      }
      resetForm();
    } catch (error) {
      console.error("Error saving post:", error);
      setMessage(`Error saving post: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (post) => {
    setSelectedPost(post);
    setFormTitle(post.title); // Restored
    setFormContent(post.content);
    // setFormImageUrl(post.imageUrl || ""); // Removed
    setMessage("");
  };

  const handleDeleteClick = (post) => {
    setPostToDelete(post);
    setModalType("confirmDelete");
    setModalMessage(
      `Are you sure you want to delete "${post.title}"? This action cannot be undone.`
    );
    setShowModal(true);
  };

  const confirmDelete = async () => {
    if (!db || !user || !userId || !postToDelete) {
      setMessage("Authentication required or no post selected for deletion.");
      setShowModal(false);
      return;
    }

    try {
      await deleteDoc(
        doc(db, `artifacts/${appId}/users/${userId}/posts`, postToDelete.id)
      );
      setMessage("Post deleted successfully!");
      resetForm();
      setPostToDelete(null);
      setShowModal(false);
    } catch (error) {
      console.error("Error deleting post:", error);
      setMessage(`Error deleting post: ${error.message}`);
      setShowModal(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType("");
    setModalMessage("");
    setPostToDelete(null);
  };

  if (loading && posts.length === 0)
    // Show initial loading only if posts aren't there yet
    return (
      <div className="text-center text-gray-600 mt-8">
        Loading admin panel...
      </div>
    );
  if (!user)
    return (
      <div className="text-center text-red-500 mt-8">
        Please log in to access the admin panel.
      </div>
    );

  // Define modules and formats for ReactQuill
  const quillModules = {
    toolbar: {
      container: [
        [{ header: [1, 2, false] }],
        ["bold", "italic", "underline", "strike", "blockquote"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link", "image"], // 'image' will now use our custom handler
        ["clean"],
      ],
      handlers: {
        image: imageHandler, // Register the custom image handler
      },
    },
  };

  const quillFormats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "blockquote",
    "list",
    "link",
    "image", // Ensure 'image' format is allowed
  ];

  return (
    <div className="container mx-auto p-6 mt-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Admin Panel</h2>

      {message && (
        <div
          className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded-lg relative mb-4"
          role="alert"
        >
          <span className="block sm:inline">{message}</span>
          <span className="absolute top-0 bottom-0 right-0 px-4 py-3">
            <svg
              onClick={() => setMessage("")}
              className="fill-current h-6 w-6 text-blue-500 cursor-pointer"
              role="button"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
            >
              <title>Close</title>
              <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.103l-2.651 2.651a1.2 1.2 0 1 1-1.697-1.697L8.303 9.406l-2.651-2.651a1.2 1.2 0 1 1 1.697-1.697L10 7.709l2.651-2.651a1.2 1.2 0 0 1 1.697 1.697L11.697 9.406l2.651 2.651a1.2 1.2 0 0 1 0 1.697z" />
            </svg>
          </span>
        </div>
      )}

      {/* Post Form */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8 border border-gray-100">
        <h3 className="text-2xl font-semibold text-gray-800 mb-4">
          {selectedPost ? "Edit Post" : "Create New Post"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title Input Restored */}
          <div>
            <label
              htmlFor="title"
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              Title:
            </label>
            <input
              type="text"
              id="title"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="border border-gray-300 rounded-lg w-full py-2 px-3 text-gray-800 leading-tight focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              required
            />
          </div>
          <div>
            {/* <label
              htmlFor="content" // Label might be redundant now if it's the only main field
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              Content:
            </label> */}
            <ReactQuill
              ref={quillRef} // Assign the ref here
              theme="snow"
              value={formContent}
              onChange={setFormContent}
              modules={quillModules}
              formats={quillFormats}
              className="bg-white rounded-lg shadow-sm border border-gray-300 min-h-[300px]"
              placeholder="Start writing your post..."
            />
          </div>
          {/* Image URL Input Removed */}
          <div className="flex space-x-4 pt-4">
            <button
              type="submit"
              className={`bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg transition duration-300 ease-in-out shadow-md ${
                imageUploading || (loading && !posts.length === 0)
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
              disabled={imageUploading || (loading && !posts.length === 0)}
            >
              {selectedPost ? "Update Post" : "Create Post"}
            </button>
            {selectedPost && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg transition duration-300 ease-in-out shadow-md"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Post List for Admin */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-2xl font-semibold text-gray-800 mb-4">
          Your Posts
        </h3>
        {posts.length === 0 ? (
          <p className="text-gray-600">You haven't created any posts yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {posts.map((post) => (
              <li
                key={post.id}
                className="py-4 flex items-center justify-between"
              >
                <div>
                  <h4 className="text-lg font-medium text-gray-900">
                    {/* This will need adjustment if post.title is no longer saved */}
                    {post.title || "Untitled Post"}
                  </h4>
                  <p
                    className="text-sm text-gray-500 line-clamp-1"
                    dangerouslySetInnerHTML={{ __html: post.content }}
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => handleEdit(post)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-300 ease-in-out shadow-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteClick(post)}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-300 ease-in-out shadow-sm"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Custom Modal for Confirmation/Info */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {modalType === "confirmDelete"
                ? "Confirm Deletion"
                : "Information"}
            </h3>
            <p className="text-gray-700 mb-6">{modalMessage}</p>
            <div className="flex justify-end space-x-4">
              {modalType === "confirmDelete" && (
                <>
                  <button
                    onClick={closeModal}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-5 rounded-lg transition duration-300 ease-in-out"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-5 rounded-lg transition duration-300 ease-in-out shadow-md"
                  >
                    Delete
                  </button>
                </>
              )}
              {modalType === "info" && (
                <button
                  onClick={closeModal}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg transition duration-300 ease-in-out shadow-md"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;

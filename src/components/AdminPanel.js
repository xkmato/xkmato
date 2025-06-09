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
  const { db, user, userId, isAuthReady } = useContext(FirebaseContext);
  const storage = getStorage(app);

  const [posts, setPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formTags, setFormTags] = useState([]);
  const [formIsDraft, setFormIsDraft] = useState(false);
  const [formImageUrl, setFormImageUrl] = useState(""); // Add image URL state
  const [availableCategories, setAvailableCategories] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [imageUploading, setImageUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [postToDelete, setPostToDelete] = useState(null);
  const quillRef = useRef(null);

  // Load categories and tags
  useEffect(() => {
    if (!db || !isAuthReady || !userId) return;

    const categoriesRef = collection(
      db,
      `artifacts/${appId}/users/${userId}/categories`
    );
    const tagsRef = collection(db, `artifacts/${appId}/users/${userId}/tags`);

    const unsubscribeCategories = onSnapshot(categoriesRef, (snapshot) => {
      const categories = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAvailableCategories(categories);
    });

    const unsubscribeTags = onSnapshot(tagsRef, (snapshot) => {
      const tags = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAvailableTags(tags);
    });

    return () => {
      unsubscribeCategories();
      unsubscribeTags();
    };
  }, [db, userId, isAuthReady]);

  useEffect(() => {
    if (
      !db ||
      !isAuthReady ||
      user?.uid !== process.env.REACT_APP_ADMIN_USER_UID ||
      !userId
    )
      return;
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
          setMessage("Failed to load posts for admin.");
          setLoading(false);
        }
      },
      (err) => {
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
    setFormTags([]);
    setFormIsDraft(false);
    setFormImageUrl(""); // Reset image URL
    setSelectedCategory("");
    setSelectedTag("");
    setNewCategoryName("");
    setNewTagName("");
    setShowNewCategoryInput(false);
    setShowNewTagInput(false);
    setMessage("");
  };

  // Create new category
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      setMessage("Category name cannot be empty.");
      return;
    }

    try {
      await addDoc(
        collection(db, `artifacts/${appId}/users/${userId}/categories`),
        {
          name: newCategoryName.trim(),
          createdAt: new Date(),
          userId,
        }
      );
      setMessage("Category created successfully!");
      setNewCategoryName("");
      setShowNewCategoryInput(false);
    } catch (error) {
      setMessage(`Error creating category: ${error.message}`);
    }
  };

  // Create new tag
  const handleCreateTag = async () => {
    if (!newTagName.trim() || !selectedCategory) {
      setMessage("Tag name and category selection are required.");
      return;
    }

    const category = availableCategories.find(
      (cat) => cat.id === selectedCategory
    );
    if (!category) {
      setMessage("Selected category not found.");
      return;
    }

    try {
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/tags`), {
        name: newTagName.trim(),
        categoryId: selectedCategory,
        categoryName: category.name,
        createdAt: new Date(),
        userId,
      });
      setMessage("Tag created successfully!");
      setNewTagName("");
      setShowNewTagInput(false);
    } catch (error) {
      setMessage(`Error creating tag: ${error.message}`);
    }
  };

  // Add tag to post
  const handleAddTag = () => {
    if (!selectedTag) {
      setMessage("Please select a tag.");
      return;
    }

    const tag = availableTags.find((t) => t.id === selectedTag);

    if (!tag) {
      setMessage("Selected tag not found.");
      return;
    }

    // Check if tag is already added
    if (formTags.some((t) => t.id === tag.id)) {
      setMessage("Tag already added to this post.");
      return;
    }

    const newFormTags = [
      ...formTags,
      {
        id: tag.id,
        name: tag.name,
        categoryId: tag.categoryId,
        categoryName: tag.categoryName,
      },
    ];

    setFormTags(newFormTags);
    setSelectedTag("");
  };

  // Remove tag from post
  const handleRemoveTag = (tagId) => {
    setFormTags(formTags.filter((tag) => tag.id !== tagId));
  };

  // Get filtered tags based on selected category
  const getFilteredTags = () => {
    if (!selectedCategory) return availableTags;
    return availableTags.filter((tag) => tag.categoryId === selectedCategory);
  };

  // Independent image upload function
  const handleImageUpload = () => {
    if (!storage) {
      setMessage("Firebase Storage is not initialized. Cannot upload image.");
      return;
    }
    if (!userId) {
      setMessage("User not authenticated. Cannot upload image.");
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
          setMessage(
            `Image upload failed: ${error.message}. Ensure storage rules allow writes.`
          );
          setImageUploading(false);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref)
            .then((downloadURL) => {
              setFormImageUrl(downloadURL);
              setMessage("Image uploaded successfully! URL copied to form.");
              setImageUploading(false);
            })
            .catch((error) => {
              setMessage(
                `Error retrieving image URL after upload: ${error.message}`
              );
              setImageUploading(false);
            });
        }
      );
    };
  };

  // Remove the old imageHandler function and update quillModules
  const quillModules = {
    toolbar: {
      container: [
        [{ header: [1, 2, false] }],
        ["bold", "italic", "underline", "strike", "blockquote"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link"],
        ["clean"],
      ],
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
  ];

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
    const MAX_FIRESTORE_FIELD_BYTES = 1048487;

    if (contentByteLength > MAX_FIRESTORE_FIELD_BYTES) {
      const currentSizeKB = Math.round(contentByteLength / 1024);
      const maxSizeKB = Math.round(MAX_FIRESTORE_FIELD_BYTES / 1024);
      setMessage(
        `Error: Post content is too large (${currentSizeKB}KB). The maximum size is ~${maxSizeKB}KB.`
      );
      return;
    }

    setLoading(true);
    setMessage(selectedPost ? "Updating post..." : "Creating post...");

    try {
      const postData = {
        title: formTitle,
        content: formContent,
        tags: formTags,
        tagIds: formTags.map((tag) => tag.id), // Add this line
        isDraft: formIsDraft,
        imageUrl: formImageUrl || null, // Include image URL
        updatedAt: new Date(),
        userId,
      };

      if (selectedPost) {
        const postRef = doc(
          db,
          `artifacts/${appId}/users/${userId}/posts`,
          selectedPost.id
        );
        await updateDoc(postRef, postData);
        setMessage(
          `Post ${formIsDraft ? "saved as draft" : "published"} successfully!`
        );
      } else {
        await addDoc(
          collection(db, `artifacts/${appId}/users/${userId}/posts`),
          {
            ...postData,
            createdAt: new Date(),
          }
        );
        setMessage(
          `Post ${formIsDraft ? "saved as draft" : "created"} successfully!`
        );
      }
      resetForm();
    } catch (error) {
      setMessage(`Error saving post: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (post) => {
    setSelectedPost(post);
    setFormTitle(post.title);
    setFormContent(post.content);
    setFormTags(post.tags || []);
    setFormIsDraft(post.isDraft || false);
    setFormImageUrl(post.imageUrl || "");
    setMessage("");
  };

  // Quick publish/unpublish function
  const togglePostStatus = async (post) => {
    if (!db || !user || !userId) {
      setMessage("Authentication required to change post status.");
      return;
    }

    try {
      const postRef = doc(
        db,
        `artifacts/${appId}/users/${userId}/posts`,
        post.id
      );
      const newDraftStatus = !post.isDraft;

      await updateDoc(postRef, {
        isDraft: newDraftStatus,
        updatedAt: new Date(),
      });

      setMessage(
        `Post ${newDraftStatus ? "moved to draft" : "published"} successfully!`
      );
    } catch (error) {
      setMessage(`Error changing post status: ${error.message}`);
    }
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

  // Add this function after the other handler functions, before the return statement

  // const migrateExistingPosts = async () => {
  //   if (!db || !user || !userId) {
  //     setMessage("Authentication required for migration.");
  //     return;
  //   }

  //   setLoading(true);
  //   setMessage("Starting migration of existing posts...");

  //   try {
  //     const postsRef = collection(
  //       db,
  //       `artifacts/${appId}/users/${userId}/posts`
  //     );
  //     const postsSnapshot = await getDocs(postsRef);

  //     let updatedCount = 0;
  //     let skippedCount = 0;

  //     for (const postDoc of postsSnapshot.docs) {
  //       const postData = postDoc.data();

  //       // Skip if isDraft already exists
  //       if (postData.isDraft === false) {
  //         skippedCount++;
  //         continue;
  //       }

  //       // Extract tag IDs from the existing tags array
  //       const tagIds = postData.tags
  //         ? postData.tags.map((tag) => tag.id).filter(Boolean)
  //         : [];

  //       // Update the post with tagIds
  //       const postRef = doc(
  //         db,
  //         `artifacts/${appId}/users/${userId}/posts`,
  //         postDoc.id
  //       );
  //       await updateDoc(postRef, {
  //         isDraft: false,
  //         updatedAt: new Date(),
  //       });

  //       updatedCount++;
  //     }

  //     setMessage(
  //       `Migration completed! Updated ${updatedCount} posts, skipped ${skippedCount} posts that already had isDraft.`
  //     );
  //   } catch (error) {
  //     setMessage(`Migration failed: ${error.message}`);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

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

  return (
    <div className="container mx-auto p-6 mt-8">
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
          {/* Title Input */}
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

          {/* Image Upload Section */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Featured Image:
            </label>
            <div className="space-y-3">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleImageUpload}
                  disabled={imageUploading}
                  className={`bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-300 ease-in-out shadow-sm ${
                    imageUploading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {imageUploading ? "Uploading..." : "Upload Image"}
                </button>
                {formImageUrl && (
                  <button
                    type="button"
                    onClick={() => setFormImageUrl("")}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-300 ease-in-out shadow-sm"
                  >
                    Remove Image
                  </button>
                )}
              </div>

              <input
                type="url"
                value={formImageUrl}
                onChange={(e) => setFormImageUrl(e.target.value)}
                placeholder="Or paste image URL here..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />

              {formImageUrl && (
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <p className="text-sm text-gray-600 mb-2">Image Preview:</p>
                  <img
                    src={formImageUrl}
                    alt="Preview"
                    className="max-w-full h-32 object-cover rounded border"
                    onError={() => setMessage("Invalid image URL")}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Draft Status Toggle */}
          <div className="flex items-center space-x-3">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formIsDraft}
                onChange={(e) => setFormIsDraft(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none ${
                  formIsDraft ? "bg-gray-600" : "bg-green-600"
                }`}
              >
                <span
                  className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                    formIsDraft ? "translate-x-1" : "translate-x-6"
                  }`}
                />
              </div>
              <span className="ml-3 text-sm font-medium text-gray-700">
                {formIsDraft ? "Draft" : "Published"}
              </span>
            </label>
            <span className="text-xs text-gray-500">
              {formIsDraft ? "Only visible to you" : "Visible to everyone"}
            </span>
          </div>

          {/* Tags Section */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Tags:
            </label>

            {/* Category Management */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-700 mb-2">
                Categories & Tags
              </h4>

              {/* Create Category */}
              <div className="mb-3">
                {!showNewCategoryInput ? (
                  <button
                    type="button"
                    onClick={() => setShowNewCategoryInput(true)}
                    className="text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded"
                  >
                    + New Category
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Category name"
                      className="flex-1 px-2 py-1 border rounded text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewCategoryInput(false);
                        setNewCategoryName("");
                      }}
                      className="bg-gray-400 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Category Selection */}
              <div className="mb-3">
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setSelectedTag(""); // Reset tag selection when category changes
                  }}
                  className="w-full px-2 py-1 border rounded text-sm"
                >
                  <option value="">Select Category</option>
                  {availableCategories.map((category, index) => (
                    <option
                      key={`category-${category.id}-${index}`}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Create Tag */}
              {selectedCategory && (
                <div className="mb-3">
                  {!showNewTagInput ? (
                    <button
                      type="button"
                      onClick={() => setShowNewTagInput(true)}
                      className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                    >
                      + New Tag
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="Tag name"
                        className="flex-1 px-2 py-1 border rounded text-sm"
                      />
                      <button
                        type="button"
                        onClick={handleCreateTag}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                      >
                        Create
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewTagInput(false);
                          setNewTagName("");
                        }}
                        className="bg-gray-400 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tag Selection and Addition */}
              {selectedCategory && (
                <div className="flex gap-2">
                  <select
                    value={selectedTag}
                    onChange={(e) => setSelectedTag(e.target.value)}
                    className="flex-1 px-2 py-1 border rounded text-sm"
                  >
                    <option value="">Select Tag</option>
                    {getFilteredTags().map((tag, index) => (
                      <option key={`tag-${tag.id}-${index}`} value={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded text-sm"
                  >
                    Add Tag
                  </button>
                </div>
              )}
            </div>

            {/* Selected Tags Display */}
            {formTags.length > 0 && (
              <div className="mb-4">
                <h5 className="text-sm font-semibold text-gray-700 mb-2">
                  Selected Tags:
                </h5>
                <div className="flex flex-wrap gap-2">
                  {formTags.map((tag, index) => (
                    <span
                      key={`selected-tag-${tag.id}-${index}`}
                      className="inline-flex items-center bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"
                    >
                      <span className="text-gray-500 text-xs mr-1">
                        {tag.categoryName}:
                      </span>
                      {tag.name}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag.id)}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Content Editor */}
          <div>
            <ReactQuill
              ref={quillRef}
              theme="snow"
              value={formContent}
              onChange={setFormContent}
              modules={quillModules}
              formats={quillFormats}
              className="bg-white rounded-lg shadow-sm border border-gray-300 min-h-[300px]"
              placeholder="Start writing your post..."
            />
          </div>

          {/* Submit Buttons */}
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
              {selectedPost
                ? formIsDraft
                  ? "Save Draft"
                  : "Update & Publish"
                : formIsDraft
                ? "Save as Draft"
                : "Create & Publish"}
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

      {/* Post List - Update to show image */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        {/* <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-semibold text-gray-800">Your Posts</h3>
          <button
            onClick={migrateExistingPosts}
            disabled={loading}
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-300 ease-in-out shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Migrate Posts (Add isDraft)
          </button>
        </div> */}
        {posts.length === 0 ? (
          <p className="text-gray-600">You haven't created any posts yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {posts.map((post, index) => (
              <li
                key={`post-${post.id}-${index}`}
                className="py-4 flex items-center justify-between"
              >
                <div className="flex-1 flex items-start gap-4">
                  {/* Post Image Thumbnail */}
                  {post.imageUrl && (
                    <img
                      src={post.imageUrl}
                      alt={post.title}
                      className="w-16 h-16 object-cover rounded-lg border border-gray-200 flex-shrink-0"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-lg font-medium text-gray-900 truncate">
                        {post.title || "Untitled Post"}
                      </h4>
                      {post.isDraft && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Draft
                        </span>
                      )}
                    </div>
                    <p
                      className="text-sm text-gray-500 line-clamp-1 mb-2"
                      dangerouslySetInnerHTML={{ __html: post.content }}
                    />
                    {/* Display tags */}
                    {post.tags && post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {post.tags.map((tag, tagIndex) => (
                          <span
                            key={`post-tag-${post.id}-${tag.id}-${tagIndex}`}
                            className="inline-flex items-center bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded"
                          >
                            <span className="text-gray-400 mr-1">
                              {tag.categoryName}:
                            </span>
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex space-x-3 ml-4">
                  <button
                    onClick={() => togglePostStatus(post)}
                    className={`${
                      post.isDraft
                        ? "bg-green-500 hover:bg-green-600"
                        : "bg-yellow-500 hover:bg-yellow-600"
                    } text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-300 ease-in-out shadow-sm`}
                  >
                    {post.isDraft ? "Publish" : "Draft"}
                  </button>
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

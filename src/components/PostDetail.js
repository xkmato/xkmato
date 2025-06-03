const PostDetail = ({ post, onBack }) => {
  if (!post) return null;

  return (
    <div className="container mx-auto p-6 bg-white rounded-xl shadow-md mt-8 border border-gray-100">
      <button
        onClick={onBack}
        className="mb-6 inline-block bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition duration-300 ease-in-out"
      >
        &larr; Back to Posts
      </button>
      {post.imageUrl && (
        <img
          src={post.imageUrl}
          alt={post.title}
          className="w-full h-80 object-cover rounded-lg mb-6"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = `https://placehold.co/800x400/E0E0E0/333333?text=Image+Unavailable`;
          }}
        />
      )}
      <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
        {post.title}
      </h1>
      {post.createdAt && (
        <p className="text-gray-500 text-sm mb-6">
          Published on: {new Date(post.createdAt.toDate()).toLocaleDateString()}
        </p>
      )}
      <div
        className="prose max-w-none text-gray-700 leading-relaxed"
        style={{ whiteSpace: "pre-wrap" }}
      >
        {post.content}
      </div>
    </div>
  );
};

export default PostDetail;

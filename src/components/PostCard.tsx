import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useShogun } from 'shogun-button-react';
import { usePostInteractions } from '../hooks/usePostInteractions';
import { useUserProfile } from '../hooks/useUserProfile';
import { useReplies } from '../hooks/useReplies';
import { useSocialProtocol } from '../hooks/useSocialProtocol';
import { formatRelativeTime } from '../utils/postUtils';
import type { Post } from '../utils/postUtils';

interface PostCardProps {
  post: Post;
  onReply?: () => void;
  onDelete?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onReply, onDelete }) => {
  const { userPub: currentUserPub } = useShogun();
  const location = useLocation();
  const { deletePost, getPostTags, getPostAuthor } = useSocialProtocol();
  
  // Use authorProfile from post if available, otherwise try to load it using bidirectional reference
  const { profile: loadedProfile, loading: profileLoading } = useUserProfile(
    post.authorProfile ? undefined : post.author
  );
  
  // Also try to get author using bidirectional reference if we have postId but no profile
  const [authorProfileFromRef, setAuthorProfileFromRef] = useState<typeof loadedProfile | null>(null);
  
  React.useEffect(() => {
    if (!post.authorProfile && post.id && !loadedProfile) {
      getPostAuthor(post.id, (profile) => {
        setAuthorProfileFromRef({
          username: profile.displayName,
          avatar: profile.avatarCid || undefined,
          bio: profile.bio,
        });
      });
    }
  }, [post.id, post.authorProfile, loadedProfile, getPostAuthor]);
  
  const profile = post.authorProfile || authorProfileFromRef || loadedProfile;
  const {
    likePost,
    unlikePost,
    repost,
    unrepost,
    isLiked,
    isReposted,
    getLikeCount,
    getRepostCount,
  } = usePostInteractions();
  const { publishPost } = useSocialProtocol();
  
  // Get tags for this post using bidirectional references
  const [postTags, setPostTags] = useState<Array<{ name: string; slug: string }>>([]);
  
  useEffect(() => {
    if (!post.id) return;
    
    const cleanup = getPostTags(post.id, (tag) => {
      setPostTags((prev) => {
        // Avoid duplicates
        if (prev.some(t => t.slug === tag.slug)) {
          return prev;
        }
        return [...prev, tag];
      });
    });
    
    return cleanup;
  }, [post.id, getPostTags]);

  const [isLiking, setIsLiking] = useState(false);
  const [isReposting, setIsReposting] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const liked = isLiked(post);
  const reposted = isReposted(post);
  const likeCount = getLikeCount(post);
  const repostCount = getRepostCount(post);

  const displayName = profile?.username || post.author.substring(0, 8) + '...';
  const isOwnPost = post.author === currentUserPub;
  // Check if we're on the My Posts page
  const isMyPostsPage = location.pathname === '/my-posts';
  // Check if this is a reposted post:
  // - In My Posts page: any post that's not owned by user is a repost (they wouldn't be in My Posts otherwise)
  // - In other pages: check if user has reposted it
  const isRepostedPost = isMyPostsPage 
    ? !isOwnPost 
    : !isOwnPost && reposted;

  const handleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);
    if (liked) {
      await unlikePost(post.id);
    } else {
      await likePost(post.id);
    }
    setIsLiking(false);
  };

  const handleRepost = async () => {
    if (isReposting) return;
    setIsReposting(true);
    try {
      // If it's a reposted post in My Posts, always unrepost
      // Otherwise, check the reposted state
      if (isRepostedPost || reposted) {
        const result = await unrepost(post.id);
        if (result.success && onReply) {
          // Refresh the list after unrepost
          setTimeout(() => onReply(), 300);
        }
      } else {
        const result = await repost(post.id);
        if (result.success && onReply) {
          // Refresh the list after repost
          setTimeout(() => onReply(), 300);
        }
      }
    } finally {
      setIsReposting(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || isReplying) return;

    setIsReplying(true);
    console.log('Replying to post:', post.id, 'with content:', replyContent);
    // Use publishPost with replyToId for content-addressed replies
    const result = await publishPost(replyContent, null, post.id);
    setIsReplying(false);

    if (result.success) {
      console.log('Reply created successfully:', result.id);
      setReplyContent('');
      setShowReplyForm(false);
      // Force a small delay to let GunDB sync
      setTimeout(() => {
        if (onReply) {
          onReply();
        }
      }, 500);
    } else {
      console.error('Failed to create reply:', result.error);
    }
  };

  const handleDelete = async () => {
    if (isDeleting || !isOwnPost) return;
    
    setIsDeleting(true);
    const result = await deletePost(post.id);
    setIsDeleting(false);
    setShowDeleteConfirm(false);

    if (result.success) {
      console.log('Post deleted successfully:', post.id);
      if (onDelete) {
        onDelete();
      }
    } else {
      console.error('Failed to delete post:', result.error);
      alert(result.error || 'Failed to delete post');
    }
  };

  return (
    <div className="card content-card p-6 mb-4 w-full">
      <div className="flex gap-4">
        {/* Avatar */}
        <div className="avatar placeholder">
          {profile?.avatar ? (
            <div className="rounded-full w-12 h-12">
              <img 
                src={profile.avatar} 
                alt={profile?.username || 'Avatar'} 
                className="rounded-full w-12 h-12 object-cover"
                onError={(e) => {
                  // Fallback to placeholder if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const placeholder = document.createElement('div');
                    placeholder.className = 'bg-shogun-primary text-shogun-primary-content rounded-full w-12 h-12 flex items-center justify-center';
                    placeholder.innerHTML = `<span class="text-lg">${profile?.username?.[0]?.toUpperCase() || post.author[0]?.toUpperCase() || '?'}</span>`;
                    parent.appendChild(placeholder);
                  }
                }}
              />
            </div>
          ) : (
            <div className="bg-shogun-primary text-shogun-primary-content rounded-full w-12 h-12 flex items-center justify-center">
              <span className="text-lg">
                {profile?.username?.[0]?.toUpperCase() || post.author[0]?.toUpperCase() || '?'}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Link
                to={`/profile/${post.author}`}
                className="font-semibold hover:underline"
              >
                {displayName}
              </Link>
              <Link
                to={`/post/${encodeURIComponent(post.id)}`}
                className="text-shogun-secondary text-sm hover:underline flex items-center gap-1"
                title="View post"
                onClick={(e) => {
                  // Ensure navigation happens
                  e.stopPropagation();
                }}
              >
                {formatRelativeTime(post.timestamp)}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3 w-3 opacity-50 pointer-events-none"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </Link>
              {isOwnPost && (
                <span className="badge badge-sm badge-shogun-primary">You</span>
              )}
              {isRepostedPost && (
                <span className="badge badge-sm badge-success">Reposted</span>
              )}
            </div>
            {isOwnPost && (
              <div className="relative">
                {!showDeleteConfirm ? (
                  <button
                    className="btn btn-ghost btn-xs text-error hover:bg-error/20"
                    onClick={() => setShowDeleteConfirm(true)}
                    title="Delete post"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-error">Delete?</span>
                    <button
                      className="btn btn-xs btn-error"
                      onClick={handleDelete}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <span className="loading loading-spinner loading-xs"></span>
                      ) : (
                        'Yes'
                      )}
                    </button>
                    <button
                      className="btn btn-xs btn-ghost"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeleting}
                    >
                      No
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Post content */}
          <div className="mb-4 whitespace-pre-wrap break-words">
            {post.content}
          </div>

          {/* Post Tags (from bidirectional references) */}
          {postTags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {postTags.map((tag) => (
                <Link
                  key={tag.slug}
                  to={`/hashtag/${tag.slug}`}
                  className="badge badge-primary badge-sm hover:badge-secondary transition-colors"
                >
                  #{tag.name}
                </Link>
              ))}
            </div>
          )}

          {/* Media/Image */}
          {post.media && (
            <div className="mb-4">
              <img
                src={post.media.startsWith('http') || post.media.startsWith('data:') 
                  ? post.media 
                  : `https://ipfs.io/ipfs/${post.media}`}
                alt="Post media"
                className="max-w-full rounded-lg object-contain max-h-96 w-full"
                onError={(e) => {
                  // Hide image if it fails to load
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Reply indicator */}
          {post.replyTo && (
            <div className="text-sm text-shogun-shogun-secondary mb-2">
              Replying to post
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-6">
            {/* Reply */}
            <button
              className="btn btn-ghost btn-sm gap-2"
              onClick={() => setShowReplyForm(!showReplyForm)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              Reply
            </button>

            {/* Like */}
            <button
              className={`btn btn-ghost btn-sm gap-2 ${liked ? 'text-error' : ''}`}
              onClick={handleLike}
              disabled={isLiking}
            >
              {isLiking ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-5 w-5 ${liked ? 'fill-current' : ''}`}
                  fill={liked ? 'currentColor' : 'none'}
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              )}
              {likeCount > 0 && likeCount}
            </button>

            {/* Repost / Remove Repost */}
            {isRepostedPost ? (
              // Show "Remove" button for reposted posts in My Posts
              <button
                className="btn btn-sm btn-error btn-outline gap-2"
                onClick={handleRepost}
                disabled={isReposting}
                title="Remove this repost from your posts"
              >
                {isReposting ? (
                  <span className="loading loading-spinner loading-xs"></span>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                    Remove
                  </>
                )}
              </button>
            ) : (
              // Show normal repost button for other cases
              <button
                className={`btn btn-ghost btn-sm gap-2 ${reposted ? 'text-success' : ''}`}
                onClick={handleRepost}
                disabled={isReposting}
                title={reposted ? 'You reposted this' : 'Repost this post'}
              >
                {isReposting ? (
                  <span className="loading loading-spinner loading-xs"></span>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 ${reposted ? 'fill-current' : ''}`}
                    fill={reposted ? 'currentColor' : 'none'}
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                )}
                {repostCount > 0 && repostCount}
              </button>
            )}
          </div>

          {/* Reply form */}
          {showReplyForm && (
            <form onSubmit={handleReply} className="mt-4 pt-4 border-t border-base-300">
              <textarea
                className="textarea textarea-bordered w-full h-24 resize-none mb-2"
                placeholder="Write a reply..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                disabled={isReplying}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setShowReplyForm(false);
                    setReplyContent('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-shogun-primary btn-sm"
                  disabled={!replyContent.trim() || isReplying}
                >
                  {isReplying ? (
                    <>
                      <span className="loading loading-spinner loading-xs"></span>
                      Replying...
                    </>
                  ) : (
                    'Reply'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Replies - Show for all posts, with depth limit to avoid infinite nesting */}
          <RepliesSection postId={post.id} onReply={onReply} maxDepth={3} currentDepth={0} />
        </div>
      </div>
    </div>
  );
};

// Separate component for replies to avoid circular dependency
// Supports nested replies with depth limit
const RepliesSection: React.FC<{ 
  postId: string; 
  onReply?: () => void;
  maxDepth?: number;
  currentDepth?: number;
}> = ({ postId, onReply, maxDepth = 3, currentDepth = 0 }) => {
  const { replies, loading: repliesLoading } = useReplies(postId);

  // Don't hide while loading - show a loading indicator instead
  if (repliesLoading && replies.length === 0) {
    return (
      <div className="mt-4 pt-4 border-t border-base-300">
        <span className="text-xs text-shogun-secondary">Loading replies...</span>
      </div>
    );
  }

  if (replies.length === 0) {
    return null;
  }

  // Limit nesting depth to avoid infinite recursion
  const shouldShowNestedReplies = currentDepth < maxDepth;
  const nextDepth = currentDepth + 1;

  return (
    <div className={`mt-4 pt-4 border-t border-base-300 ${currentDepth > 0 ? 'ml-4 opacity-90' : ''}`}>
      <h4 className="text-sm font-semibold mb-3 text-shogun-secondary">
        {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
      </h4>
      <div className="space-y-3">
        {replies.map((reply) => (
          <div key={reply.id}>
            <PostCard 
              post={reply} 
              onReply={onReply} 
              onDelete={onReply}
            />
            {/* Show nested replies if within depth limit */}
            {shouldShowNestedReplies && (
              <RepliesSection 
                postId={reply.id} 
                onReply={onReply} 
                maxDepth={maxDepth}
                currentDepth={nextDepth}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};


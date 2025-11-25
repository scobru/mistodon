import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useShogun } from 'shogun-button-react';
import { useSocialProtocol } from '../hooks/useSocialProtocol';
import { PostCard } from './PostCard';
import { useReplies } from '../hooks/useReplies';
import type { Post } from '../utils/postUtils';

export const PostDetail: React.FC = () => {
  const { postId: rawPostId } = useParams<{ postId: string }>();
  const postId = rawPostId ? decodeURIComponent(rawPostId) : undefined;
  const navigate = useNavigate();
  const { sdk, core } = useShogun();
  const shogunCore = sdk || core;
  const { socialNetwork, isReady, getPostAuthor } = useSocialProtocol();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { replies, loading: repliesLoading } = useReplies(postId || '');

  useEffect(() => {
    if (!isReady || !socialNetwork || !postId || !shogunCore?.gun) {
      if (!isReady || !socialNetwork) {
        setLoading(false);
        return;
      }
      if (!postId) {
        setError('Post ID not provided');
        setLoading(false);
        return;
      }
      return;
    }

    setLoading(true);
    setError(null);

    const gun = shogunCore.gun;
    const appName = 'shogun-mistodon-clone-v1';
    let found = false;

    const loadPostFromSoul = (postSoul: string) => {
      if (!postSoul || typeof postSoul !== 'string' || found) return;
      
      found = true;
      
      // Get the actual post data using the soul
      gun.get(postSoul).once((postData: any) => {
        if (postData && typeof postData === 'object') {
          const { _, ...cleanPostData } = postData;
          
          // Convert to Post format (content-addressed uses authorPub/text)
          const post: Post = {
            id: postId, // Use hash as ID
            author: cleanPostData.authorPub || cleanPostData.author || '',
            content: cleanPostData.text || cleanPostData.content || '',
            timestamp: cleanPostData.timestamp || Date.now(),
            likes: cleanPostData.likes || {},
            reposts: cleanPostData.reposts || {},
            replyTo: cleanPostData.replyTo || undefined,
            media: cleanPostData.media || undefined,
          };

          // Get likes/reposts from interactions node (posts are immutable)
          const likesNode = gun.get(appName).get('posts').get(postId).get('likes');
          const repostsNode = gun.get(appName).get('posts').get(postId).get('reposts');
          
          // Load likes
          const likes: Record<string, boolean> = {};
          likesNode.map().once((likeValue: any, likeKey: string) => {
            if (likeKey && !likeKey.startsWith('_') && (likeValue === true || (likeValue && typeof likeValue === 'object' && !likeValue._))) {
              likes[likeKey] = true;
            }
          });
          
          // Load reposts
          const reposts: Record<string, boolean> = {};
          repostsNode.map().once((repostValue: any, repostKey: string) => {
            if (repostKey && !repostKey.startsWith('_') && (repostValue && typeof repostValue === 'object' && !repostValue._)) {
              reposts[repostKey] = true;
            }
          });
          
          // Update post with interactions after a small delay to allow data to load
          setTimeout(() => {
            post.likes = likes;
            post.reposts = reposts;
            
            // Use getPostAuthor (bidirectional reference) instead of getUserProfile
            getPostAuthor(postId, (profile) => {
              setPost({
                ...post,
                authorProfile: {
                  username: profile.displayName,
                  avatar: profile.avatarCid,
                  bio: profile.bio,
                },
              });
              setLoading(false);
            });
          }, 100);
        } else {
          setError('Post data not found');
          setLoading(false);
        }
      });
    };

    // Method 1: Try to get post from content-addressed storage (#posts)
    const hashNode = gun.get('#posts').get(postId);
    hashNode.on((postSoul: string) => {
      if (postSoul && typeof postSoul === 'string') {
        loadPostFromSoul(postSoul);
      }
    });

    // Method 2: Try to find in timeline (check last 7 days)
    const today = new Date();
    const timelineListeners: Array<() => void> = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const timeKey = date.toISOString().split('T')[0];
      
      const timelineNode = gun.get(appName).get('timeline').get(timeKey).get(postId);
      timelineNode.on((postSoul: string) => {
        if (postSoul && typeof postSoul === 'string') {
          loadPostFromSoul(postSoul);
        }
      });
      
      timelineListeners.push(() => {
        try {
          timelineNode.off();
        } catch (e) {
          // Ignore cleanup errors
        }
      });
    }

    // Timeout after 8 seconds if post not found (more time for sync)
    const timeout = setTimeout(() => {
      if (!found) {
        setError('Post not found');
        setLoading(false);
      }
    }, 8000);

    return () => {
      clearTimeout(timeout);
      try {
        hashNode.off();
        // Clean up timeline listeners
        timelineListeners.forEach(cleanup => cleanup());
      } catch (e) {
        console.error('Error cleaning up post listener:', e);
      }
    };
  }, [isReady, socialNetwork, postId, shogunCore, getPostAuthor]);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center p-8">
        <span className="loading loading-spinner loading-lg"></span>
        <p className="ml-4 text-shogun-secondary">Initializing...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <span className="loading loading-spinner loading-lg"></span>
        <p className="ml-4 text-shogun-secondary">Loading post...</p>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="card content-card p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Post Not Found</h2>
          <p className="text-shogun-secondary mb-6">{error || 'The post you are looking for does not exist.'}</p>
          <button
            className="btn btn-shogun-primary"
            onClick={() => navigate('/')}
          >
            Back to Timeline
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4">
        <button
          className="btn btn-ghost btn-sm gap-2"
          onClick={() => navigate(-1)}
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
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back
        </button>
      </div>

      {/* Main post */}
      <PostCard post={post} />

      {/* Show parent post if this is a reply */}
      {post.replyTo && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2 text-shogun-secondary">
            Replying to:
          </h3>
          <ParentPost postId={post.replyTo} />
        </div>
      )}

      {/* Replies section */}
      {!repliesLoading && replies.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xl font-bold mb-4">
            {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
          </h3>
          <div className="space-y-4">
            {replies.map((reply) => (
              <PostCard key={reply.id} post={reply} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Component to show parent post (if this is a reply)
// Now uses the new bidirectional getParentPost method
const ParentPost: React.FC<{ postId: string }> = ({ postId }) => {
  const { getParentPost } = useSocialProtocol();
  const [parentPost, setParentPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postId) {
      setLoading(false);
      return;
    }

    // Use the new bidirectional getParentPost method
    getParentPost(postId, (post) => {
      if (post) {
        const convertedPost: Post = {
          id: post.id,
          author: post.authorPub || post.author || '',
          content: post.text || post.content || '',
          timestamp: post.timestamp || Date.now(),
          likes: post.likes || {},
          reposts: post.reposts || {},
          replyTo: post.replyTo || undefined,
          media: post.media || undefined,
          authorProfile: post.authorProfile ? {
            username: post.authorProfile.displayName,
            avatar: post.authorProfile.avatarCid || undefined,
            bio: post.authorProfile.bio,
          } : undefined,
        };
        setParentPost(convertedPost);
      }
      setLoading(false);
    });
  }, [postId, getParentPost]);

  if (loading) {
    return (
      <div className="card content-card p-4">
        <span className="loading loading-spinner loading-sm"></span>
        <span className="ml-2 text-sm text-shogun-secondary">Loading parent post...</span>
      </div>
    );
  }

  if (!parentPost) {
    return (
      <div className="card content-card p-4">
        <p className="text-sm text-shogun-secondary">Parent post not found</p>
      </div>
    );
  }

  return (
    <div className="opacity-75">
      <PostCard post={parentPost} />
    </div>
  );
};


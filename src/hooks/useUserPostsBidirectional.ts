/**
 * Hook for loading posts from a specific user using bidirectional references (GUN Design Pattern)
 * This is a simpler alternative to useUserPosts that uses the new getUserPosts method
 * Note: This doesn't handle reposts - use useUserPosts if you need repost support
 */

import { useState, useEffect, useCallback } from 'react';
import { useSocialProtocol } from './useSocialProtocol';
import type { Post } from '../utils/postUtils';
import type { PostWithAuthor } from '../utils/socialProtocol';

interface UseUserPostsBidirectionalReturn {
  posts: Post[];
  loading: boolean;
  error: string | null;
  refreshPosts: () => void;
}

/**
 * Hook for loading posts from a specific user using bidirectional references
 * Uses the new getUserPosts method from SocialProtocol
 */
export function useUserPostsBidirectional(userPub: string): UseUserPostsBidirectionalReturn {
  const { getUserPosts, isReady } = useSocialProtocol();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPosts = useCallback(() => {
    if (!isReady || !userPub) {
      setLoading(false);
      return () => {}; // Return empty cleanup function
    }

    setLoading(true);
    setError(null);

    const postsMap = new Map<string, Post>();

    // Use the bidirectional getUserPosts method
    const cleanup = getUserPosts(userPub, (postWithAuthor: PostWithAuthor) => {
      if (!postWithAuthor || !postWithAuthor.id) {
        return;
      }

      // Convert PostWithAuthor to Post format
      const post: Post = {
        id: postWithAuthor.id,
        author: postWithAuthor.authorPub || postWithAuthor.author || '',
        content: postWithAuthor.text || postWithAuthor.content || '',
        timestamp: postWithAuthor.timestamp || Date.now(),
        likes: postWithAuthor.likes || {},
        reposts: postWithAuthor.reposts || {},
        replyTo: postWithAuthor.replyTo || undefined,
        media: postWithAuthor.media || undefined,
        authorProfile: postWithAuthor.authorProfile ? {
          username: postWithAuthor.authorProfile.displayName,
          avatar: postWithAuthor.authorProfile.avatarCid || undefined,
          bio: postWithAuthor.authorProfile.bio,
        } : undefined,
      };

      postsMap.set(post.id, post);

      // Convert to array and sort by timestamp (newest first)
      const postsArray = Array.from(postsMap.values()).sort(
        (a, b) => b.timestamp - a.timestamp
      );

      setPosts(postsArray);
      setLoading(false);
    });

    // Set loading to false after initial load attempt
    const timeoutId = setTimeout(() => {
      if (postsMap.size === 0) {
        setLoading(false);
      }
    }, 5000);

    // Return cleanup function
    return () => {
      clearTimeout(timeoutId);
      try {
        cleanup();
      } catch (e) {
        console.error('Error cleaning up getUserPosts listener:', e);
      }
    };
  }, [getUserPosts, isReady, userPub]);

  // Refresh posts
  const refreshPosts = useCallback(() => {
    loadPosts();
  }, [loadPosts]);

  // Load posts on mount and when dependencies change
  useEffect(() => {
    const cleanup = loadPosts();
    return cleanup;
  }, [loadPosts]);

  return {
    posts,
    loading,
    error,
    refreshPosts,
  };
}


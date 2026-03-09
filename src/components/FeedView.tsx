import { useState, useEffect, useCallback } from 'react';
import { getFeed, getUserFridgePosts } from '../api/posts';
import type { ApiPost } from '../api/posts';
import PostCard from './PostCard';
import { useAuth } from '../AuthContext';

interface FeedViewProps {
  filter?: 'fridge';
}

export default function FeedView({ filter }: FeedViewProps) {
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const data = filter === 'fridge'
        ? await getUserFridgePosts(currentUser.id)
        : await getFeed();
      setPosts(data);
    } catch {
      setError('Could not load posts. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [filter, currentUser]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const handlePostDeleted = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const handlePostUpdated = (updated: ApiPost) => {
    setPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  if (loading) {
    return (
      <div style={{ padding: '24px 8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.08)',
            height: '420px',
            animation: 'pulse 1.5s ease-in-out infinite',
            margin: '0 8px'
          }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: 'white', textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
        <p style={{ opacity: 0.8 }}>{error}</p>
        <button
          onClick={loadPosts}
          style={{ marginTop: '16px', padding: '10px 24px', borderRadius: '20px', background: 'var(--color-orange)', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div style={{ color: 'white', textAlign: 'center', padding: '60px 20px', opacity: 0.8 }}>
        {filter === 'fridge' ? (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🧊</div>
            <p>Your fridge is empty.<br />Save some posts!</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🍽️</div>
            <p>No posts yet.<br />Be the first to share!</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="feed-posts" style={{ padding: '0 8px' }}>
      {posts.map(post => (
        <PostCard key={post.id} post={post} onDeleted={handlePostDeleted} onUpdated={handlePostUpdated} />
      ))}
    </div>
  );
}

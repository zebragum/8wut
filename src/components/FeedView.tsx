import { useState, useEffect, useCallback } from 'react';
import { getFeed, getDiscoveryFeed, getUserFridgePosts } from '../api/posts';
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
  const [scope, setScope] = useState<'everyone' | 'friends'>('everyone');
  const [viewMode, setViewMode] = useState<'grid' | 'card'>('card');

  const loadPosts = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      let data: ApiPost[];
      if (filter === 'fridge') {
        data = await getUserFridgePosts(currentUser.id);
      } else {
        data = scope === 'everyone' ? await getDiscoveryFeed() : await getFeed();
      }
      setPosts(data);
    } catch {
      setError('Could not load posts. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [filter, currentUser, scope]);

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
            height: viewMode === 'grid' ? '200px' : '420px',
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

  return (
    <div className="feed-view-container">
      {!filter && (
        <div className="feed-controls" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Scope Toggle: Everyone | Friends */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '20px', padding: '4px', alignSelf: 'center' }}>
            <button 
              onClick={() => setScope('everyone')}
              style={{ 
                padding: '6px 20px', borderRadius: '16px', border: 'none', 
                background: scope === 'everyone' ? 'var(--color-orange)' : 'transparent',
                color: 'white', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem'
              }}
            >
              Everyone
            </button>
            <button 
              onClick={() => setScope('friends')}
              style={{ 
                padding: '6px 20px', borderRadius: '16px', border: 'none', 
                background: scope === 'friends' ? 'var(--color-orange)' : 'transparent',
                color: 'white', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem'
              }}
            >
              Friends
            </button>
          </div>

          {/* View Toggle: Grid | Card */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
            <button 
              className={`toggle-btn-sq ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              style={{ fontSize: '0.85rem', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z"/>
              </svg>
            </button>
            <button 
              className={`toggle-btn-sq ${viewMode === 'card' ? 'active' : ''}`}
              onClick={() => setViewMode('card')}
              style={{ fontSize: '0.85rem', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="3" ry="3"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {posts.length === 0 ? (
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
      ) : viewMode === 'grid' ? (
        <div className="profile-grid-clean" style={{ padding: '0 8px' }}>
          {posts.map(post => (
            <div 
              key={post.id} 
              className="grid-cell" 
              onClick={() => setViewMode('card')} 
              style={{ 
                cursor: 'pointer',
                background: post.text_background || 'rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                textAlign: 'center',
                overflow: 'hidden',
                position: 'relative',
                borderRadius: '8px'
              }}
            >
              {post.images && post.images.length > 0 ? (
                <img src={post.images[0]} alt="Post" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ 
                  fontSize: '0.7rem', 
                  color: 'white', 
                  fontWeight: '700',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {post.caption}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="feed-posts" style={{ padding: '0 8px' }}>
          {posts.map(post => (
            <PostCard key={post.id} post={post} onDeleted={handlePostDeleted} onUpdated={handlePostUpdated} />
          ))}
        </div>
      )}
    </div>
  );
}

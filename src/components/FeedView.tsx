import { useState, useEffect, useCallback, useRef } from 'react';
import { getDiscoveryFeed, getUserFridgePosts } from '../api/posts';
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

  const [viewMode, setViewMode] = useState<'grid' | 'card'>('card');
  const [focusedPost, setFocusedPost] = useState<ApiPost | null>(null);

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadPosts = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      let data: ApiPost[] = [];
      if (filter === 'fridge') {
        data = await getUserFridgePosts(currentUser.id);
        setHasMore(false);
      } else {
        const discoveryPosts = await getDiscoveryFeed(20, 0);
        data = discoveryPosts.filter(p => p.scope === 'everyone');
        setHasMore(discoveryPosts.length === 20);
      }
      setPosts(data);
      setPage(0);
    } catch {
      setError('Could not load posts. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [filter, currentUser]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const loadMore = useCallback(async () => {
    if (!currentUser || loadingMore || !hasMore || filter === 'fridge') return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const offset = nextPage * 20;
      const discoveryPosts = await getDiscoveryFeed(20, offset);
      const data = discoveryPosts.filter(p => p.scope === 'everyone');
      setPosts(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newUnique = data.filter(p => !existingIds.has(p.id));
        return [...prev, ...newUnique];
      });
      setPage(nextPage);
      setHasMore(discoveryPosts.length === 20);
    } catch {
      console.error('Could not load more posts');
    } finally {
      setLoadingMore(false);
    }
  }, [currentUser, loadingMore, hasMore, filter, page]);

  // Keep a ref to the latest loadMore so the scroll handler never calls a stale version
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  // SCROLL-EVENT BASED infinite scroll (replaces IntersectionObserver which deadlocked)
  useEffect(() => {
    const scrollContainer = document.querySelector('.main-content');
    if (!scrollContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      if (scrollHeight - scrollTop - clientHeight < 800) {
        loadMoreRef.current();
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    // Also check immediately in case content is shorter than viewport
    handleScroll();

    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [page, hasMore, loadingMore]);

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
          {/* Scope Toggle removed - only Everyone now */}

          {/* View Toggle: Grid | Card */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
            <button 
              className={`toggle-btn-sq ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => { setViewMode('grid'); setFocusedPost(null); }}
              style={{ fontSize: '0.85rem', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z"/>
              </svg>
            </button>
            <button 
              className={`toggle-btn-sq ${viewMode === 'card' ? 'active' : ''}`}
              onClick={() => { setViewMode('card'); setFocusedPost(null); }}
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
        focusedPost ? (
          <div style={{ padding: '0 8px' }}>
            <button 
              onClick={() => setFocusedPost(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
                padding: '14px 24px', borderRadius: '24px', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '1.2rem', fontWeight: 'bold',
                marginBottom: '16px', backdropFilter: 'blur(4px)'
              }}
            >
              <span style={{ fontSize: '1.6rem' }}>←</span> Back to grid
            </button>
            <PostCard post={focusedPost} onDeleted={handlePostDeleted} onUpdated={handlePostUpdated} />
          </div>
        ) : (
          <div className="profile-grid-clean" style={{ padding: '0 8px', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {posts.map(post => (
              <div 
                key={post.id} 
                className="grid-cell" 
                onClick={() => setFocusedPost(post)} 
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
                {/* Username overlay */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 6px 4px', background: 'linear-gradient(transparent, var(--overlay-bg))', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <img src={post.author.avatarUrl} alt="" style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {post.author.username}
                    </span>
                  </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="feed-posts" style={{ padding: '0 8px' }}>
          {posts.map(post => (
            <PostCard key={post.id} post={post} onDeleted={handlePostDeleted} onUpdated={handlePostUpdated} />
          ))}
        </div>
      )}
      
      {/* Scroll-based loading indicator */}
      {loadingMore && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
          <div style={{ width: '24px', height: '24px', border: '3px solid var(--color-orange)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}
      {!hasMore && posts.length > 0 && (
        <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>You've reached the beginning of time 🕰️</div>
      )}
    </div>
  );
}

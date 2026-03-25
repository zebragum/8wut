import { useState, useCallback, useRef } from 'react';
import type { ApiPost } from '../api/posts';
import { searchPosts } from '../api/posts';
import { searchUsers } from '../api/users';
import type { ApiUser } from '../api/auth';
import PostCard from './PostCard';
import toast from 'react-hot-toast';

export default function SearchPostsView() {
  const [query, setQuery] = useState('');
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'users'>('posts');
  
  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setPosts([]);
      setUsers([]);
      setHasSearched(false);
      return;
    }
    
    setLoading(true);
    setHasSearched(true);
    try {
      // Run both searches independently so one failure doesn't kill the other
      const [postResult, userResult] = await Promise.allSettled([
        searchPosts(searchQuery),
        searchUsers(searchQuery)
      ]);
      setPosts(postResult.status === 'fulfilled' ? postResult.value : []);
      setUsers(userResult.status === 'fulfilled' ? userResult.value : []);
      if (postResult.status === 'rejected') console.error('Post search failed:', postResult.reason);
      if (userResult.status === 'rejected') console.error('User search failed:', userResult.reason);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.details || 'Search failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSearch(val);
    }, 500);
  };

  const handlePostDeleted = (id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  const handlePostUpdated = (updatedPost: ApiPost) => {
    setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
  };

  const handleUserClick = (userId: string) => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'profile', userId } }));
  };

  return (
    <div className="search-posts-view" style={{ padding: '0 0 100px 0', width: '100%', maxWidth: '600px', margin: '0 auto' }}>
      
      {/* Search Input Header */}
      <div style={{ padding: '16px', position: 'sticky', top: '130px', zIndex: 50 }}>
        <input 
          type="text" 
          value={query}
          onChange={handleSearchChange}
          placeholder="Search..."
          autoFocus
          style={{
            width: '100%', padding: '14px 20px', borderRadius: '24px', border: 'none',
            background: 'var(--color-skyblue)', color: 'white', fontFamily: 'inherit',
            fontSize: '1.2rem', fontWeight: '500', outline: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}
        />
      </div>

      {/* Tabs */}
      {hasSearched && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '0 16px 12px' }}>
          <button 
            onClick={() => setActiveTab('posts')}
            style={{
              flex: 1, padding: '10px', borderRadius: '12px', border: 'none',
              background: activeTab === 'posts' ? 'var(--color-orange)' : 'rgba(255,255,255,0.1)',
              color: 'white', fontWeight: 'bold', fontFamily: 'inherit', cursor: 'pointer', fontSize: '0.95rem'
            }}
          >
            Posts {posts.length > 0 && `(${posts.length})`}
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            style={{
              flex: 1, padding: '10px', borderRadius: '12px', border: 'none',
              background: activeTab === 'users' ? 'var(--color-lavender)' : 'rgba(255,255,255,0.1)',
              color: 'white', fontWeight: 'bold', fontFamily: 'inherit', cursor: 'pointer', fontSize: '0.95rem'
            }}
          >
            Users {users.length > 0 && `(${users.length})`}
          </button>
        </div>
      )}

      {/* Results Area */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'white', opacity: 0.7 }}>Searching...</div>
      ) : hasSearched && posts.length === 0 && users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'white', opacity: 0.6 }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🧐</div>
          <p style={{ fontSize: '1.2rem' }}>No matches found for "{query}"</p>
        </div>
      ) : hasSearched ? (
        <>
          {/* POSTS TAB */}
          {activeTab === 'posts' && (
            posts.length > 0 ? (
              <div className="feed-view-list" style={{ marginTop: '8px' }}>
                {posts.map(post => (
                  <PostCard 
                    key={post.id} 
                    post={post} 
                    onDeleted={handlePostDeleted}
                    onUpdated={handlePostUpdated}
                  />
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.5)' }}>No posts found for "{query}"</div>
            )
          )}

          {/* USERS TAB */}
          {activeTab === 'users' && (
            users.length > 0 ? (
              <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {users.map((u: any) => (
                  <div 
                    key={u.id} 
                    onClick={() => handleUserClick(u.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
                      background: 'rgba(255,255,255,0.08)', padding: '14px', borderRadius: '16px',
                      transition: 'background 0.2s'
                    }}
                  >
                    <img src={u.avatar_url || u.avatarUrl} alt="" style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-lavender)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 'bold', color: 'white', fontSize: '1rem' }}>{u.username}</div>
                      {u.bio && <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.bio}</div>}
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.5)' }}>No users found for "{query}"</div>
            )
          )}
        </>
      ) : null}

      {/* Helper text when empty */}
      {!hasSearched && !loading && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'white', opacity: 0.5 }}>
          <p style={{ fontSize: '1.1rem' }}>Type above to search users and posts.</p>
        </div>
      )}
    </div>
  );
}

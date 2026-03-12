import { useState, useCallback, useRef } from 'react';
import type { ApiPost } from '../api/posts';
import PostCard from './PostCard';
import toast from 'react-hot-toast';

export default function SearchPostsView() {
  const [query, setQuery] = useState('');
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setPosts([]);
      setHasSearched(false);
      return;
    }
    
    setLoading(true);
    setHasSearched(true);
    try {
      // Inline fetch to avoid circular deps or needing to export a new function from api/posts right now
      const token = localStorage.getItem('8wut_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/posts/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setPosts(data);
    } catch (err) {
      toast.error('Search failed');
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

  return (
    <div className="search-posts-view" style={{ padding: '0 0 100px 0', width: '100%', maxWidth: '600px', margin: '0 auto' }}>
      
      {/* Search Input Header */}
      <div style={{ padding: '16px', position: 'sticky', top: '0', zIndex: 50, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <input 
          type="text" 
          value={query}
          onChange={handleSearchChange}
          placeholder="Search posts..."
          autoFocus
          style={{
            width: '100%', padding: '14px 20px', borderRadius: '24px', border: 'none',
            background: 'var(--color-skyblue)', color: 'white', fontFamily: 'inherit',
            fontSize: '1.2rem', fontWeight: '500', outline: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}
        />
      </div>

      {/* Results Area */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'white', opacity: 0.7 }}>Searching...</div>
      ) : hasSearched && posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'white', opacity: 0.6 }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🧐</div>
          <p style={{ fontSize: '1.2rem' }}>No posts found matching "{query}"</p>
        </div>
      ) : (
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
      )}

      {/* Helper text when empty */}
      {!hasSearched && !loading && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'white', opacity: 0.5 }}>
          <p style={{ fontSize: '1.1rem' }}>Type above to search all public posts.</p>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { getPost } from '../api/posts';
import type { ApiPost } from '../api/posts';
import PostCard from './PostCard';
import toast from 'react-hot-toast';

export default function PostDetailView({ postId }: { postId: string }) {
  const [post, setPost] = useState<ApiPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPost(postId)
      .then(setPost)
      .catch(() => toast.error('Could not load post'))
      .finally(() => setLoading(false));
  }, [postId]);

  if (loading || !post) {
    return (
      <div style={{ padding: '20px 8px' }}>
        <div style={{ height: '400px', background: 'rgba(255,255,255,0.08)', borderRadius: '16px', margin: '0 8px', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '0 8px', paddingBottom: '110px' }}>
      <button 
        onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'notifications' }))}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
          padding: '10px 20px', borderRadius: '20px', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: '1rem', fontWeight: 'bold',
          marginBottom: '12px', marginTop: '8px'
        }}
      >
        <span style={{ fontSize: '1.4rem' }}>←</span> Back
      </button>
      <PostCard 
        post={post} 
        onDeleted={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'feed' }))}
        onUpdated={(updated) => setPost(updated)}
      />
    </div>
  );
}

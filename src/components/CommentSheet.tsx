import { useState, useEffect, useRef } from 'react';
import { getComments, addComment } from '../api/posts';
import type { ApiComment } from '../api/posts';
import { useAuth } from '../AuthContext';
import toast from 'react-hot-toast';

interface CommentSheetProps {
  postId: string;
  onClose: () => void;
  onCommentAdded?: () => void;
}

export default function CommentSheet({ postId, onClose, onCommentAdded }: CommentSheetProps) {
  const { currentUser } = useAuth();
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getComments(postId)
      .then(setComments)
      .catch(() => toast.error('Could not load comments'))
      .finally(() => setLoading(false));

    // Auto-focus input
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [postId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    try {
      const comment = await addComment(postId, newComment.trim());
      setComments(prev => [...prev, comment]);
      setNewComment('');
      onCommentAdded?.();
      onClose();
    } catch {
      toast.error('Could not post comment');
    } finally {
      setSubmitting(false);
    }
  };



  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 5000,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.5)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(180deg, rgba(30,30,30,0.98) 0%, rgba(20,20,20,0.99) 100%)',
          borderRadius: '24px 24px 0 0',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          paddingBottom: 'env(safe-area-inset-bottom, 16px)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px' }}>
          <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.3)' }} />
        </div>

        <h3 style={{ margin: '0 0 16px 0', textAlign: 'center', color: 'white', fontSize: '1rem', fontWeight: '600' }}>
          Comments
        </h3>

        {/* Comments list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '40px' }}>Loading...</div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '40px' }}>
              No comments yet. Be the first!
            </div>
          ) : (
            comments.map(comment => (
              <div key={comment.id} style={{
                display: 'flex', gap: '12px', alignItems: 'flex-start',
                marginBottom: '16px'
              }}>
                <img
                  src={comment.author.avatarUrl}
                  alt={comment.author.username}
                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: 'none', cursor: 'pointer' }}
                  onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'profile', userId: comment.author.id } })); }}
                />
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700, color: 'white', fontSize: '0.9rem' }}>{comment.author.username}</span>
                  {' '}
                  <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem' }}>{comment.text}</span>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginTop: '2px' }}>{formatTime(comment.timestamp)}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Comment input */}
        <form onSubmit={handleSubmit} style={{
          display: 'flex', gap: '8px', padding: '12px 16px',
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          <img
            src={currentUser?.avatar_url}
            alt={currentUser?.username}
            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: 'none' }}
          />
          <input
            ref={inputRef}
            type="text"
            placeholder="Add a comment..."
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            style={{
              flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '20px', padding: '8px 16px', color: 'white',
              fontFamily: 'inherit', fontSize: '0.9rem', outline: 'none'
            }}
          />
          <button
            type="submit"
            disabled={!newComment.trim() || submitting}
            style={{
              background: newComment.trim() ? 'var(--color-skyblue)' : 'rgba(255,255,255,0.2)',
              border: 'none', borderRadius: '20px', padding: '8px 16px',
              color: 'white', fontWeight: 'bold', cursor: newComment.trim() ? 'pointer' : 'default',
              transition: 'all 0.2s', fontFamily: 'inherit', fontSize: '0.9rem'
            }}
          >
            Post
          </button>
        </form>
      </div>
    </div>
  );
}

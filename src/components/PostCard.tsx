import { useState } from 'react';
import type { ApiPost } from '../api/posts';
import { likePost, unlikePost, saveToFridge, removeFromFridge, updatePost, deletePost } from '../api/posts';
import { useAuth } from '../AuthContext';
import toast from 'react-hot-toast';
import CommentSheet from './CommentSheet';
import { parseMentions } from '../utils/parseMentions';

type PostCardProps = {
  post: ApiPost;
  onDeleted?: (id: string) => void;
  onUpdated?: (post: ApiPost) => void;
};

export default function PostCard({ post: initialPost, onDeleted, onUpdated }: PostCardProps) {
  const { currentUser } = useAuth();
  const [post, setPost] = useState(initialPost);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption);
  const [editCreatedAt, setEditCreatedAt] = useState(
    new Date(new Date(post.created_at).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16)
  );
  const [editScope, setEditScope] = useState(post.scope || 'everyone');
  const [showComments, setShowComments] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const isOwner = currentUser?.id === post.author.id;

  const handleLike = async () => {
    // Optimistic UI
    const wasLiked = post.hasLiked;
    setPost(prev => ({ ...prev, hasLiked: !prev.hasLiked, likes: prev.likes + (prev.hasLiked ? -1 : 1) }));
    if (!wasLiked) {
      setShowHeartAnim(true);
      setTimeout(() => setShowHeartAnim(false), 500);
    }
    try {
      const result = wasLiked ? await unlikePost(post.id) : await likePost(post.id);
      setPost(prev => ({ ...prev, ...result }));
    } catch {
      // Revert on error
      setPost(prev => ({ ...prev, hasLiked: wasLiked, likes: prev.likes + (wasLiked ? 1 : -1) }));
      toast.error('Could not update like');
    }
  };

  const handleSave = async () => {
    const wasSaved = post.savedToFridge;
    setPost(prev => ({ ...prev, savedToFridge: !prev.savedToFridge }));
    try {
      const result = wasSaved ? await removeFromFridge(post.id) : await saveToFridge(post.id);
      setPost(prev => ({ ...prev, ...result }));
      toast.success(wasSaved ? 'Removed from fridge' : '🧊 Saved to fridge!', { duration: 1500 });
    } catch {
      setPost(prev => ({ ...prev, savedToFridge: wasSaved }));
      toast.error('Could not update fridge');
    }
  };

  const handleSaveEdit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await updatePost(post.id, editCaption, new Date(editCreatedAt).toISOString(), editScope);
      setPost(updated);
      onUpdated?.(updated);
      setIsEditing(false);
      toast.success('Post updated!');
    } catch {
      toast.error('Could not update post');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    try {
      await deletePost(post.id);
      onDeleted?.(post.id);
      toast.success('Post deleted');
    } catch {
      toast.error('Could not delete post');
    }
  };

  // Swipe to change image
  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null || !post.images?.length) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0 && activeImageIndex < post.images.length - 1) setActiveImageIndex(i => i + 1);
      if (diff < 0 && activeImageIndex > 0) setActiveImageIndex(i => i - 1);
    }
    setTouchStart(null);
  };

  const textBg = post.textBackground || post.text_background;

  return (
    <>
      <div className="post-card">
        <div className="post-images-container" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {/* Author overlay */}
          <div style={{
            position: 'absolute', top: '12px', left: '12px', zIndex: 10,
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--overlay-bg)', padding: '4px 10px 4px 4px',
            borderRadius: '24px', backdropFilter: 'blur(4px)'
          }}>
            <img
              src={post.author.avatarUrl}
              alt={post.author.username}
              className="avatar-small"
              style={{ width: '36px', height: '36px', border: 'none', cursor: 'pointer' }}
              onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'profile', userId: post.author.id } }))}
            />
            <span
              className="username font-bold"
              style={{ color: 'inherit', textShadow: '0 1px 3px rgba(0,0,0,0.3)', cursor: 'pointer' }}
              onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'profile', userId: post.author.id } }))}
            >
              {post.author.username}
            </span>
          </div>

          {post.images && post.images.length > 0 ? (
            <>
              <div
                className="images-slider"
                style={{ transform: `translateX(-${activeImageIndex * 100}%)`, border: `3px solid var(--color-${textBg || 'skyblue'})`, borderRadius: '12px', boxSizing: 'border-box' }}
              >
                {post.images.map((img, idx) => (
                  <div key={idx} className="image-slide" onDoubleClick={handleLike}>
                    <img src={img} alt={`Post ${idx}`} loading="lazy" />
                  </div>
                ))}
              </div>
              {post.images.length > 1 && (
                <div className="slider-dots">
                  {post.images.map((_, idx) => (
                    <span
                      key={idx}
                      className={`dot ${idx === activeImageIndex ? 'active' : ''}`}
                      onClick={() => setActiveImageIndex(idx)}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div
              className={`bg-${textBg || 'skyblue'}`}
              style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
              onDoubleClick={handleLike}
            >
              <h2 className="text-post-content font-bold" style={{ textAlign: 'center', margin: 0, textShadow: '1px 1px 3px rgba(0,0,0,0.6)', whiteSpace: 'pre-wrap' }}>
                {post.caption}
              </h2>
            </div>
          )}

          {/* Heart animation */}
          {showHeartAnim && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: '4rem', pointerEvents: 'none', animation: 'slideUpFade 0.5s ease forwards', zIndex: 20 }}>
              ❤️
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="post-actions-bar" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 4px 14px', width: '100%', background: 'transparent' }}>
          <div className="action-left-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px', background: 'transparent' }}>
            <button 
              className="action-btn-inline" 
              onClick={() => setShowComments(true)}
              style={{ background: 'none', border: 'none', padding: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', outline: 'none' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '22px', height: '22px' }}>
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              {post.commentsCount > 0 && <span className="action-count" style={{ fontSize: '0.9rem', fontWeight: 600 }}>{post.commentsCount}</span>}
            </button>

            <button 
              className="action-btn-inline" 
              onClick={handleLike}
              style={{ background: 'none', border: 'none', padding: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', outline: 'none' }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill={post.hasLiked ? "var(--color-orange)" : "none"}
                stroke={post.hasLiked ? "var(--color-orange)" : "currentColor"}
                strokeWidth="2"
                className={showHeartAnim ? "heart-animated" : ""}
                style={{ width: '22px', height: '22px' }}
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {post.likes > 0 && <span className="action-count" style={{ fontSize: '0.9rem', fontWeight: 600 }}>{post.likes > 999 ? '1k+' : post.likes}</span>}
            </button>

            <button 
              className={`action-btn-inline ${post.savedToFridge ? 'saved' : ''}`} 
              onClick={handleSave}
              style={{ background: 'none', border: 'none', padding: 0, color: 'white', display: 'flex', alignItems: 'center', cursor: 'pointer', outline: 'none' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill={post.savedToFridge ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: post.savedToFridge ? 'var(--color-skyblue)' : 'inherit' }}>
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                <line x1="4" y1="9" x2="20" y2="9" />
                <line x1="8" y1="4" x2="8" y2="7" />
                <line x1="8" y1="11" x2="8" y2="20" />
              </svg>
            </button>
          </div>

          {isOwner && !isEditing && (
            <button
              className="edit-link-white"
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'white', opacity: 0.8, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', padding: '4px 8px' }}
              onClick={() => setIsEditing(true)}
            >
              Edit
            </button>
          )}
        </div>

        {/* Caption / Edit area */}
        <div className="post-caption-area">
          {isEditing ? (
            <div className="caption-edit-mode" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <textarea
                value={editCaption}
                onChange={e => setEditCaption(e.target.value)}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px',
                  padding: '8px', color: 'inherit', fontFamily: 'inherit',
                  fontSize: '1rem', minHeight: '60px'
                }}
              />
              <input 
                type="datetime-local"
                value={editCreatedAt}
                onChange={e => setEditCreatedAt(e.target.value)}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px',
                  padding: '8px', color: 'inherit', fontFamily: 'inherit',
                  fontSize: '0.9rem'
                }}
              />
              <select
                value={editScope}
                onChange={e => {
                  const val = e.target.value as any;
                  setEditScope(val);
                  if (val === 'private' && localStorage.getItem('8wut_seenPrivateTutorial') !== 'true') {
                    alert('Private posts only show on your profile');
                    localStorage.setItem('8wut_seenPrivateTutorial', 'true');
                  }
                }}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px',
                  padding: '8px', color: 'white', fontFamily: 'inherit',
                  fontSize: '0.9rem'
                }}
              >
                <option value="everyone" style={{ color: 'black' }}>Everyone</option>
                <option value="private" style={{ color: 'black' }}>Private</option>
              </select>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <button
                  onClick={handleDelete}
                  className="delete-btn"
                  style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Delete
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => { setEditCaption(post.caption); setIsEditing(false); }}
                    style={{ padding: '6px 12px', borderRadius: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'inherit', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--color-skyblue)', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {saving ? '...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="caption-inline-header">
              {post.images && post.images.length > 0 && (
                <div>
                  <span
                    className="username font-bold"
                    onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'profile', userId: post.author.id } }))}
                    style={{ cursor: 'pointer' }}
                  >
                    {post.author.username}
                  </span>
                  {' '}
                  <span className="caption-text" style={{ marginLeft: '6px', whiteSpace: 'pre-wrap', color: 'inherit' }}>{parseMentions(post.caption)}</span>
                </div>
              )}
              <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '2px', color: 'inherit' }}>
                {new Date(post.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            </div>
          )}

          {/* Hearted Comments Inline Display */}
          {post.heartedComments && post.heartedComments.length > 0 && (
            <div className="hearted-comments-inline" style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {post.heartedComments.map(hc => (
                <div key={hc.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <img
                    src={hc.author.avatarUrl}
                    alt={hc.author.username}
                    style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover', marginTop: '3px', cursor: 'pointer' }}
                    onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'profile', userId: hc.author.id } }))}
                  />
                  <div style={{ flex: 1, fontSize: '0.9rem', lineHeight: '1.2' }}>
                    <span 
                      style={{ fontWeight: 600, color: 'inherit', cursor: 'pointer', marginRight: '4px' }}
                      onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'profile', userId: hc.author.id } }))}
                    >
                      {hc.author.username}
                    </span>
                    <span style={{ color: 'inherit', opacity: 0.85 }}>{hc.text}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showComments && (
        <CommentSheet
          postId={post.id}
          onClose={() => setShowComments(false)}
          onCommentAdded={() => setPost(prev => ({ ...prev, commentsCount: prev.commentsCount + 1 }))}
        />
      )}
    </>
  );
}

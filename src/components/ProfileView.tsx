import { useState, useEffect, useCallback } from 'react';
import { getUser, followUser, unfollowUser } from '../api/users';
import { getUserPosts, getUserFridgePosts } from '../api/posts';
import type { ApiUser } from '../api/auth';
import type { ApiPost } from '../api/posts';
import PostCard from './PostCard';
import { useAuth } from '../AuthContext';
import toast from 'react-hot-toast';

export default function ProfileView({ userId }: { userId?: string | null }) {
  const { currentUser, updateUsername, updateAvatar } = useAuth();
  const targetId = userId || currentUser?.id || '';
  const isOwnProfile = currentUser?.id === targetId;

  const [user, setUser] = useState<ApiUser | null>(null);
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [fridgePosts, setFridgePosts] = useState<ApiPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'journal'>('grid');
  const [activeTab, setActiveTab] = useState<'posts' | 'fridge'>('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newBio, setNewBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [focusedPost, setFocusedPost] = useState<ApiPost | null>(null);

  const load = useCallback(async () => {
    if (!targetId) return;
    setLoading(true);
    try {
      const [userData, userPosts, userFridge] = await Promise.all([
        getUser(targetId),
        getUserPosts(targetId),
        getUserFridgePosts(targetId)
      ]);
      setUser(userData);
      setPosts(userPosts);
      setFridgePosts(userFridge);
      setIsFollowing(userData.is_following || false);
    } catch {
      toast.error('Could not load profile');
    } finally {
      setLoading(false);
    }
  }, [targetId]);

  useEffect(() => { load(); }, [load]);

  const handleFollow = async () => {
    if (followLoading) return;
    setFollowLoading(true);
    try {
      const result = isFollowing ? await unfollowUser(targetId) : await followUser(targetId);
      setIsFollowing(result.isFollowing);
      setUser(prev => prev ? {
        ...prev,
        followers_count: (prev.followers_count || 0) + (result.isFollowing ? 1 : -1)
      } : prev);
    } catch {
      toast.error('Could not update follow');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    setSavingProfile(true);
    try {
      if (newUsername.trim() !== currentUser?.username) {
        await updateUsername(newUsername.trim());
      }
      const { updateMe } = await import('../api/users');
      // If we are editing profile normally (not specifically editing topics in overview)
      // we just update bio/username. Topics are decoupled.
      await updateMe({ bio: newBio.trim() });
      setUser(prev => prev ? { ...prev, username: newUsername.trim(), bio: newBio.trim() } : prev);
      setEditingProfile(false);
      toast.success('Profile updated!');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Could not update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { uploadImage } = await import('../api/users');
    const toastId = toast.loading('Updating avatar...');
    try {
      const url = await uploadImage(file);
      await updateAvatar(url);
      setUser(prev => prev ? { ...prev, avatar_url: url } : prev);
      toast.success('Avatar updated!', { id: toastId });
    } catch {
      toast.error('Could not update avatar', { id: toastId });
    }
  };

  if (loading || !user) {
    return (
      <div style={{ padding: '20px 8px' }}>
        <div style={{ height: '200px', background: 'rgba(255,255,255,0.08)', borderRadius: '16px', margin: '0 8px', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    );
  }


  return (
    <div className="profile-view">
      <div className="profile-header-card">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <label style={{ cursor: isOwnProfile ? 'pointer' : 'default', position: 'relative' }}>
            <img src={user.avatar_url} alt={user.username} className="profile-avatar" />
            {isOwnProfile && (
              <>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
                <div style={{
                  position: 'absolute', bottom: 0, right: 0,
                  background: 'var(--color-lavender)', borderRadius: '50%',
                  width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', fontSize: '0.8rem'
                }}>📷</div>
              </>
            )}
          </label>
        </div>

        <div className="profile-info" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <h2 className="profile-name" style={{ marginBottom: '8px', fontSize: '2rem' }}>{user.username}</h2>
          <div
            className="profile-stats-row"
            style={{ marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px 12px', fontSize: '1.2rem', fontWeight: '700', justifyContent: 'center' }}
          >
            <div><span className="count">{user.following_count || 0}</span><span className="label"> following</span></div>
            <div><span className="count">{user.followers_count || 0}</span><span className="label"> followers</span></div>
          </div>
          
          {user.bio && !editingProfile && (
            <div style={{ marginBottom: '16px', maxWidth: '80%', padding: '0 12px', margin: '0 auto 16px auto' }}>
              <p style={{ lineHeight: 1.4, fontSize: '0.95rem', margin: 0, fontStyle: 'italic', opacity: 0.9 }}>
                "{user.bio}"
              </p>
            </div>
          )}

          {isOwnProfile ? (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                className="edit-profile-btn"
                onClick={() => { setEditingProfile(true); setNewUsername(user.username); setNewBio(user.bio || ''); }}
                style={{ margin: '0' }}
              >
                edit profile
              </button>
            </div>
          ) : (
            <button
              onClick={handleFollow}
              disabled={followLoading}
              style={{
                padding: '8px 24px', borderRadius: '20px', border: 'none',
                background: isFollowing ? 'rgba(255,255,255,0.2)' : 'var(--color-orange)',
                color: 'white', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit'
              }}
            >
              {followLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="profile-tabs">
        <button className={`tab ${activeTab === 'posts' ? 'active' : ''}`} onClick={() => setActiveTab('posts')}>POSTS ({posts.length})</button>
        <button className={`tab ${activeTab === 'fridge' ? 'active' : ''}`} onClick={() => setActiveTab('fridge')}>FRIDGE ({fridgePosts.length})</button>
      </div>

      {/* Posts tab */}
      {activeTab === 'posts' && (
        <>
          <div className="profile-toggles">
            <button className={`toggle-btn-sq ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => { setViewMode('grid'); setFocusedPost(null); }} style={{ fontSize: '0.85rem', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z"/>
              </svg>
            </button>
            <button className={`toggle-btn-sq ${viewMode === 'journal' ? 'active' : ''}`} onClick={() => { setViewMode('journal'); setFocusedPost(null); }} style={{ fontSize: '0.85rem', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="3" ry="3"/>
              </svg>
            </button>
          </div>

          {posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'white', opacity: 0.6 }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📷</div>
              <p>No posts yet</p>
            </div>
          ) : (() => {
            // Both grid and journal share the same date-grouping logic
            const dateGroups: { [key: string]: ApiPost[] } = {};
            posts.forEach(post => {
              const dateObj = new Date(post.created_at);
              const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long' }) + ', ' + 
                              dateObj.toLocaleDateString('en-US', { month: 'short' }) + '. ' + 
                              dateObj.getDate() + ', ' + dateObj.getFullYear();
              if (!dateGroups[dateStr]) dateGroups[dateStr] = [];
              dateGroups[dateStr].push(post);
            });
            const colors = ['var(--color-skyblue)', 'var(--color-orange)', 'var(--color-lavender)'];

            return (
              <div className="feed-posts" style={{ padding: '0 8px' }}>
                {focusedPost ? (
                  <>
                    <button
                      onClick={() => setFocusedPost(null)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '12px' }}
                    >
                      ← Back
                    </button>
                    <PostCard post={focusedPost} />
                  </>
                ) : Object.entries(dateGroups).map(([date, groupPosts], index) => {
                  const barColor = colors[index % 3];
                  return (
                    <div key={date} className="date-group" style={{ width: '100%', display: 'flex', flexDirection: 'column', marginBottom: '16px' }}>
                      <div className="date-separator" style={{ 
                        margin: '16px 0 10px 0', 
                        padding: '12px 16px', 
                        background: barColor, 
                        color: 'white', 
                        fontSize: '1.2rem', 
                        fontWeight: 'normal', 
                        width: 'calc(100% + 16px)',
                        marginLeft: '-8px',
                        marginRight: '-8px',
                        textAlign: 'left',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                      }}>
                        {date}
                      </div>
                      {viewMode === 'grid' ? (
                        <div className="profile-grid-clean" style={{ gap: '2px' }}>
                          {groupPosts.map(post => (
                            <div 
                              key={post.id} 
                              className="grid-cell" 
                              onClick={() => setFocusedPost(post)} 
                              style={{ 
                                cursor: 'pointer',
                                background: post.text_background || 'rgba(255,255,255,0.1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '8px', textAlign: 'center', overflow: 'hidden', position: 'relative'
                              }}
                            >
                              {post.images && post.images.length > 0 ? (
                                <img src={post.images[0]} alt="Post" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: 'white', fontWeight: '700', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                  {post.caption}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        groupPosts.map(post => <PostCard key={post.id} post={post} />)
                      )}
                    </div>
                  );
                })})
              </div>
            );
          })()}
        </>
      )}

      {/* Edit Profile Modal */}
      {editingProfile && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'var(--color-skyblue)', padding: '24px', borderRadius: '16px', maxWidth: '400px', width: '100%' }}>
            <h2 style={{ marginTop: 0, color: 'white' }}>Edit Profile</h2>
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ color: 'white', display: 'block', marginBottom: '8px' }}>Username</label>
                <input 
                  type="text" 
                  value={newUsername} 
                  onChange={e => setNewUsername(e.target.value)} 
                  style={{
                    padding: '12px', borderRadius: '8px', border: 'none', width: '100%', 
                    fontFamily: 'inherit', fontSize: '1rem', background: 'rgba(255,255,255,0.2)', color: 'white'
                  }} 
                />
              </div>

              <div>
                <label style={{ color: 'white', display: 'block', marginBottom: '8px' }}>Bio</label>
                <textarea 
                  value={newBio} 
                  onChange={e => setNewBio(e.target.value)} 
                  style={{
                    padding: '12px', borderRadius: '8px', border: 'none', width: '100%', 
                    fontFamily: 'inherit', fontSize: '1rem', background: 'rgba(255,255,255,0.2)', color: 'white',
                    minHeight: '80px', resize: 'vertical'
                  }} 
                  placeholder="Tell us about yourself..."
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => setEditingProfile(false)} 
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={savingProfile}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: 'var(--color-orange)', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {savingProfile ? '...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Fridge tab */}
      {activeTab === 'fridge' && (
        <div className="feed-posts" style={{ padding: '0 8px' }}>
          {fridgePosts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'white', opacity: 0.6 }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🧊</div>
              <p>Fridge is empty. Save some posts!</p>
            </div>
          ) : (
            fridgePosts.map(post => <PostCard key={post.id} post={post} />)
          )}
        </div>
      )}

      {/* Edit Profile Modal */}
      {editingProfile && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={() => setEditingProfile(false)}
        >
          <form
            onSubmit={handleSaveProfile}
            style={{ background: 'var(--color-skyblue)', padding: '24px', borderRadius: '20px', width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '16px' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, color: 'white', textAlign: 'center' }}>Edit Profile</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', paddingLeft: '4px' }}>Username</label>
              <input
                type="text"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="New username"
                style={{ padding: '12px', borderRadius: '8px', border: 'none', fontFamily: 'inherit', fontSize: '1rem' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', paddingLeft: '4px' }}>Bio</label>
              <textarea
                value={newBio}
                onChange={e => setNewBio(e.target.value)}
                placeholder="Write a little about yourself..."
                rows={3}
                style={{ padding: '12px', borderRadius: '8px', border: 'none', fontFamily: 'inherit', fontSize: '1rem', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setEditingProfile(false)}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'transparent', border: '1px solid white', color: 'white', fontFamily: 'inherit', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={savingProfile}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'var(--color-orange)', border: 'none', color: 'white', fontWeight: 'bold', fontFamily: 'inherit', cursor: 'pointer' }}>
                {savingProfile ? '...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

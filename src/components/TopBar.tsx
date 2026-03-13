import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import Logo from './Logo';
import toast from 'react-hot-toast';
import { usePushNotifications } from '../utils/usePushNotifications';

interface TopBarProps {
  currentView: string;
}

export default function TopBar({ currentView }: TopBarProps) {
  const { currentUser, logout, updatePassword, updateUsername } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [isFood, setIsFood] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Settings form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const { isSupported, subscription, subscribe, unsubscribe } = usePushNotifications();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsFood(true);
      setTimeout(() => setIsFood(false), 1000);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match!'); return; }
    try {
      await updatePassword(currentPassword, newPassword);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      toast.success('Password updated!');
    } catch {
      toast.error('Current password is incorrect');
    }
  };

  const handleChangeUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    try {
      await updateUsername(newUsername.trim());
      setNewUsername('');
      toast.success('Username updated!');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Could not update username');
    }
  };

  let currentTitle = currentUser?.username || '';
  if (currentView === 'feed') currentTitle = isFood ? 'Food' : 'Feed';
  else if (currentView === 'eat') currentTitle = 'Fridge';
  else if (currentView === 'profile') currentTitle = 'Profile';
  else if (currentView === 'notifications') currentTitle = 'Notifications';
  else if (currentView === 'create') currentTitle = 'wut u 8';
  else if (currentView === 'admin') currentTitle = 'Admin';

  const showTitle = true;

  return (
    <header className="top-bar">
      <div
        className="top-logo-container"
        onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'feed' }))}
        style={{ padding: '33px 0 0 0', marginLeft: '-17px' }}
      >
        <Logo width="94" height="94" className="top-logo" hideText={true} transparent={true} />
      </div>

      {showTitle && (
        <h2 style={{ margin: 0, marginTop: '4px', fontFamily: "'Cooper Black', 'Fredoka One', cursive", fontSize: '1.5rem', fontWeight: 'bold', color: 'white', textShadow: '1px 1px 2px rgba(0,0,0,0.5)', position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)' }}>
          {currentTitle}
        </h2>
      )}

      <div className="top-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }} ref={menuRef}>
        <button
          className="top-create-btn"
          onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'profile' }))}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: '2px' }}
        >
          {currentUser?.avatar_url ? (
            <img
              src={currentUser.avatar_url}
              alt={currentUser.username}
              style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: 'none' }}
            />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          )}
        </button>
        <button
          className="top-create-btn"
          style={{ paddingBottom: '8px' }}
          onClick={() => setShowMenu(!showMenu)}
        >
          ⋮
        </button>

        {showMenu && (
          <div className="dropdown-menu" style={{
            position: 'absolute', top: '100%', right: '0',
            backgroundColor: 'var(--color-skyblue)', borderRadius: '8px',
            padding: '0', minWidth: '180px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 100, overflow: 'hidden'
          }}>
            <button className="dropdown-item" onClick={() => { setShowMenu(false); window.dispatchEvent(new CustomEvent('navigate', { detail: 'notifications' })); }}>Notifications</button>
            <button className="dropdown-item" onClick={() => { setShowMenu(false); window.dispatchEvent(new CustomEvent('navigate', { detail: 'search' })); }}>Search Posts</button>
            <button className="dropdown-item" onClick={() => { setShowMenu(false); setShowSettings(true); }}>Settings</button>
            {currentUser?.is_admin && (
              <button className="dropdown-item" onClick={() => { setShowMenu(false); window.dispatchEvent(new CustomEvent('navigate', { detail: 'admin' })); }}>Admin Panel</button>
            )}
            <button className="dropdown-item" onClick={() => { setShowMenu(false); window.open(`mailto:zthammond@gmail.com?subject=8wut SUPPORT (${Math.floor(Math.random() * 100000)})`); }}>Help/Support</button>
            <button className="dropdown-item" style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }} onClick={() => { setShowMenu(false); logout(); }}>Log Out</button>
          </div>
        )}
      </div>

      {showSettings && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={() => setShowSettings(false)}>
          <div className="settings-overlay" style={{ background: 'var(--color-skyblue)', padding: '24px', borderRadius: '16px', maxWidth: '400px', width: '100%', maxHeight: '80vh', overflowY: 'auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowSettings(false)} style={{ position: 'absolute', top: '16px', left: '16px', background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', fontWeight: 'bold', cursor: 'pointer', lineHeight: 1 }}>×</button>
            <h2 style={{ marginTop: 0, color: 'white' }}>Settings</h2>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '1.1rem' }}>Notifications</h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.9rem', margin: 0 }}>Push notifications</p>
                {isSupported && (
                  <button 
                    onClick={subscription ? unsubscribe : subscribe}
                    style={{ 
                      padding: '6px 12px', borderRadius: '16px', border: 'none', 
                      background: subscription ? 'rgba(255,255,255,0.2)' : 'var(--color-orange)',
                      color: 'white', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer'
                    }}
                  >
                    {subscription ? 'Enabled' : 'Disabled'}
                  </button>
                )}
                {!isSupported && <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', margin: 0 }}>Not supported</p>}
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '1.1rem' }}>Privacy & Safety</h3>
              <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.9rem', lineHeight: 1.4, margin: 0 }}>we don't track or monetize user data. All data used is only for app functionality.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <h4 style={{ margin: '0', color: 'white', textAlign: 'center', gridColumn: '1 / -1' }}>Background Theme</h4>
              {[['Grass', 'theme-grass', '#388e3c'], ['Black', 'theme-black', '#000'], ['Stars', 'theme-stars', '#000033'], ['Rave', 'theme-party', 'linear-gradient(90deg, red, orange, yellow, green, blue, purple)']].map(([label, theme, bg]) => (
                <button key={theme} style={{ padding: '14px 8px', borderRadius: '8px', border: '1px solid white', background: bg, color: 'var(--color-lavender)', fontWeight: 'bold', fontSize: '1.05rem', cursor: 'pointer', textShadow: theme === 'theme-party' ? '0 1px 2px rgba(0,0,0,0.5)' : undefined }} onClick={() => { window.dispatchEvent(new CustomEvent('change-theme', { detail: theme })); setShowSettings(false); }}>{label}</button>
              ))}
            </div>

            <form onSubmit={handleChangeUsername} style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '20px' }}>
              <h4 style={{ margin: '0', color: 'white', textAlign: 'center' }}>Change Username</h4>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" placeholder={currentUser?.username || 'New Username'} value={newUsername} onChange={e => setNewUsername(e.target.value)} style={{ padding: '12px', borderRadius: '8px', border: 'none', width: '100%', fontFamily: 'inherit', fontSize: '1rem', flex: 1 }} />
                <button type="submit" style={{ padding: '12px 24px', borderRadius: '8px', background: 'var(--color-orange)', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
              </div>
            </form>

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '20px' }}>
              <h4 style={{ margin: '0', color: 'white', textAlign: 'center' }}>Change Password</h4>
              <input type="password" placeholder="Current Password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={{ padding: '12px', borderRadius: '8px', border: 'none', width: '100%', fontFamily: 'inherit', fontSize: '1rem' }} />
              <input type="password" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ padding: '12px', borderRadius: '8px', border: 'none', width: '100%', fontFamily: 'inherit', fontSize: '1rem' }} />
              <input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ padding: '12px', borderRadius: '8px', border: 'none', width: '100%', fontFamily: 'inherit', fontSize: '1rem' }} />
              <button type="submit" style={{ marginTop: '4px', padding: '12px', borderRadius: '8px', background: 'var(--color-orange)', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Update Password</button>
            </form>

            <button style={{ padding: '12px', borderRadius: '8px', border: 'none', background: 'white', color: 'var(--color-skyblue)', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setShowSettings(false)}>Close</button>
          </div>
        </div>
      )}
    </header>
  );
}

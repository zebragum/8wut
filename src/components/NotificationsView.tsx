import { useState, useEffect } from 'react';
import { getNotifications } from '../api/users';
import type { ApiNotification } from '../api/users';
import toast from 'react-hot-toast';

const TYPE_TEXT: Record<string, string> = {
  like: 'liked your post',
  comment: 'commented on your post',
  follow: 'started following you',
  fridge: 'saved your post to their fridge'
};

export default function NotificationsView() {
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNotifications()
      .then(setNotifications)
      .catch(() => toast.error('Could not load notifications'))
      .finally(() => setLoading(false));
  }, []);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (loading) {
    return (
      <div style={{ padding: '80px 16px 110px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: '72px', borderRadius: '16px', background: 'rgba(255,255,255,0.1)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="notifications-view" style={{ padding: '0 16px', paddingBottom: '110px' }}>
      <div className="notifications-list" style={{ paddingTop: '80px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'white', opacity: 0.6 }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔔</div>
            <p>No notifications yet</p>
          </div>
        ) : (
          notifications.map(notif => (
            <div
              key={notif.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: notif.read
                  ? 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)'
                  : 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.15) 100%)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderRadius: '16px',
                padding: '14px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                border: `1px solid rgba(255,255,255,${notif.read ? '0.1' : '0.3'})`,
                transition: 'all 0.2s ease'
              }}
            >
              <img
                src={notif.user.avatarUrl}
                alt={notif.user.username}
                style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '2px solid white', flexShrink: 0, cursor: 'pointer' }}
                onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'profile', userId: notif.user.id } }))}
              />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ color: 'white', lineHeight: 1.4, fontSize: '0.9rem', textShadow: '1px 1px 2px rgba(0,0,0,0.3)' }}>
                  <span className="font-bold">{notif.user.username}</span>{' '}
                  {TYPE_TEXT[notif.type] || notif.type}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>{formatTime(notif.timestamp)}</span>
              </div>
              {notif.postImage && (
                <img
                  src={notif.postImage}
                  alt="Post preview"
                  style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                />
              )}
              {!notif.read && (
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-orange)', flexShrink: 0 }} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

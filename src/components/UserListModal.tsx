import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ApiUser } from '../api/auth';
import { getFollowers, getFollowing } from '../api/users';
import toast from 'react-hot-toast';

export interface UserListModalProps {
  title: string;
  userId: string;
  type: 'followers' | 'following';
  onClose: () => void;
}

export default function UserListModal({ title, userId, type, onClose }: UserListModalProps) {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const data = type === 'followers' ? await getFollowers(userId) : await getFollowing(userId);
        setUsers(data);
      } catch (err) {
        toast.error('Could not load users');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [userId, type]);

  const handleUserClick = (targetId: string) => {
    onClose();
    window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'profile', userId: targetId } }));
  };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', flexDirection: 'column', padding: 'env(safe-area-inset-top) 0 env(safe-area-inset-bottom) 0' }}>
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'white' }}>{title}</h2>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.5)' }}>Loading...</div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.5)' }}>No users found.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {users.map((u: any) => (
              <div 
                key={u.id} 
                onClick={() => handleUserClick(u.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px' }}
              >
                <img src={u.avatar_url || u.avatarUrl} alt="" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 'bold', color: 'white' }}>{u.username}</div>
                  {u.bio && <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.bio}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

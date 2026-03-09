import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import toast from 'react-hot-toast';

interface AdminUser {
  id: string;
  username: string;
  avatar_url: string;
  is_admin: boolean;
  created_at: string;
  invite_code_used: string;
  post_count: string;
}

interface InviteCode {
  code: string;
  times_used: number;
  max_uses: number;
  created_at: string;
  created_by_username: string;
}

export default function AdminView() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [usersRes, invitesRes] = await Promise.all([
        apiClient.get<{ users: AdminUser[]; total: number; maxUsers: number }>('/admin/users'),
        apiClient.get<InviteCode[]>('/admin/invites')
      ]);
      setUsers(usersRes.data.users);
      setTotal(usersRes.data.total);
      setInvites(invitesRes.data);
    } catch {
      toast.error('Could not load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const generateInvite = async () => {
    try {
      const { data } = await apiClient.post<InviteCode>('/admin/invites');
      setInvites(prev => [data, ...prev]);
      navigator.clipboard.writeText(data.code).catch(() => null);
      toast.success(`Invite code created: ${data.code} (copied!)`, { duration: 5000 });
    } catch {
      toast.error('Could not create invite code');
    }
  };

  const revokeInvite = async (code: string) => {
    try {
      await apiClient.delete(`/admin/invites/${code}`);
      setInvites(prev => prev.filter(i => i.code !== code));
      toast.success('Invite code revoked');
    } catch {
      toast.error('Could not revoke code');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => null);
    toast.success(`Copied: ${code}`, { duration: 2000 });
  };

  if (loading) {
    return <div style={{ padding: '80px 16px', color: 'white', textAlign: 'center' }}>Loading admin panel...</div>;
  }

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.1)',
    backdropFilter: 'blur(16px)',
    borderRadius: '16px',
    padding: '20px',
    border: '1px solid rgba(255,255,255,0.2)',
    marginBottom: '16px'
  };

  return (
    <div style={{ padding: '80px 16px 110px', color: 'white', maxWidth: '480px', margin: '0 auto' }}>
      {/* Overview */}
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '1.3rem' }}>👑 Admin Panel</h2>
        <p style={{ margin: 0, opacity: 0.8 }}>{total} / 40 alpha users</p>
        <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.2)', marginTop: '8px' }}>
          <div style={{ height: '100%', borderRadius: '3px', background: 'var(--color-orange)', width: `${(total / 40) * 100}%`, transition: 'width 0.5s ease' }} />
        </div>
      </div>

      {/* Invite codes */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>Invite Codes</h3>
          <button
            onClick={generateInvite}
            style={{ padding: '8px 16px', borderRadius: '20px', background: 'var(--color-orange)', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            + Generate
          </button>
        </div>
        {invites.length === 0 ? (
          <p style={{ opacity: 0.6, textAlign: 'center' }}>No invite codes yet</p>
        ) : (
          invites.map(invite => (
            <div key={invite.code} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px' }}>
              <code
                style={{ flex: 1, fontFamily: 'monospace', fontSize: '1rem', letterSpacing: '1px', cursor: 'pointer', color: invite.times_used >= invite.max_uses ? 'rgba(255,255,255,0.4)' : 'white' }}
                onClick={() => copyCode(invite.code)}
                title="Click to copy"
              >
                {invite.code}
              </code>
              <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{invite.times_used}/{invite.max_uses}</span>
              {invite.times_used < invite.max_uses && (
                <button onClick={() => revokeInvite(invite.code)} style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.8)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
              )}
            </div>
          ))
        )}
      </div>

      {/* User list */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 16px 0' }}>Users ({total})</h3>
        {users.map(user => (
          <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <img src={user.avatar_url} alt={user.username} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{user.username} {user.is_admin && '👑'}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                {user.post_count} posts · joined {new Date(user.created_at).toLocaleDateString()}
                {user.invite_code_used && ` · joined via ${user.invite_code_used}`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

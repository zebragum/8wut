import { useState } from 'react';
import { useAuth } from '../AuthContext';
import toast from 'react-hot-toast';

export default function AuthView() {
  const { login, register } = useAuth();
  const [isLoginView, setIsLoginView] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('Please enter a username and password.');
      return;
    }

    setLoading(true);
    try {
      if (isLoginView) {
        await login(username, password);
      } else {
        await register(username, password, undefined);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || (isLoginView ? 'Login failed. Check your credentials.' : 'Registration failed.'));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: '16px',
    borderRadius: '12px',
    border: 'none',
    fontSize: '1.1rem',
    fontFamily: 'inherit',
    background: 'white',
    outline: 'none',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)',
    color: '#333'
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(12px)',
      color: 'white',
      padding: '24px',
      overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
        <img src="/8logo.svg" alt="8wut logo" style={{ width: '220px', height: '220px', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }} />
        <p style={{ opacity: 0.8, marginTop: '16px' }}>Community Food Photojournaling</p>
      </div>

      <form
        onSubmit={handleAuth}
        style={{
          width: '100%',
          maxWidth: '360px',
          background: 'var(--color-skyblue)',
          padding: '32px',
          borderRadius: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        <h2 style={{ margin: '0 0 8px 0', textAlign: 'center', color: 'white' }}>
          {isLoginView ? 'Welcome Back' : 'Join 8wut'}
        </h2>

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          style={inputStyle}
          autoCapitalize="none"
          autoCorrect="off"
          disabled={loading}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={inputStyle}
          disabled={loading}
        />

        {!isLoginView && (
          /* Honeypot — invisible to humans, bots auto-fill it */
          <input
            type="text"
            name="website"
            value={website}
            onChange={e => setWebsite(e.target.value)}
            autoComplete="off"
            tabIndex={-1}
            style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, width: 0 }}
          />
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: '8px',
            padding: '16px',
            borderRadius: '12px',
            background: loading ? 'rgba(255,183,77,0.6)' : 'var(--color-orange)',
            border: 'none',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '1.2rem',
            cursor: loading ? 'wait' : 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            fontFamily: 'inherit',
            transition: 'all 0.2s ease'
          }}
        >
          {loading ? '...' : isLoginView ? 'Log In' : 'Create Account'}
        </button>

        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <button
            type="button"
            style={{ background: 'transparent', border: 'none', color: 'white', textDecoration: 'underline', cursor: 'pointer', opacity: 0.8, fontFamily: 'inherit' }}
            onClick={() => setIsLoginView(!isLoginView)}
          >
            {isLoginView ? "Don't have an account? Sign up" : "Already have an account? Log in"}
          </button>
        </div>
      </form>

      <p style={{ marginTop: '32px', opacity: 0.6, fontSize: '0.85rem', maxWidth: '300px', textAlign: 'center' }}>
        8wut — Community food photojournaling for the people who love to eat.
      </p>
    </div>
  );
}

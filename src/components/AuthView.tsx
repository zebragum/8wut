import { useState } from 'react';
import { useAuth } from '../AuthContext';
import toast from 'react-hot-toast';

const themes: [string, string, string][] = [
  ['🌿 Grass', 'theme-grass', '#388e3c'],
  ['🌑 Black', 'theme-black', '#111'],
  ['✨ Stars', 'theme-stars', '#000033'],
  ['🎉 Rave', 'theme-party', 'linear-gradient(90deg, red, orange, yellow, green, blue, purple)'],
];

export default function AuthView() {
  const { login, register } = useAuth();
  const [isLoginView, setIsLoginView] = useState(false); // default to signup
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [loading, setLoading] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('theme-grass');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('Pick a username and password.');
      return;
    }
    if (password.trim().length < 4) {
      toast.error('Password should be at least 4 characters.');
      return;
    }

    setLoading(true);
    try {
      if (isLoginView) {
        await login(username, password);
      } else {
        await register(username, password, undefined);
        // After successful registration, show theme picker
        setShowThemePicker(true);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || (isLoginView ? 'Login failed. Check your credentials.' : 'Registration failed.'));
    } finally {
      setLoading(false);
    }
  };

  const applyThemeAndEnter = () => {
    localStorage.setItem('8wut-theme', selectedTheme);
    window.dispatchEvent(new CustomEvent('change-theme', { detail: selectedTheme }));
    // Force a re-render by reloading — the AuthContext already has the user logged in
    window.location.reload();
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
    color: '#333',
    width: '100%'
  };

  // Step 2: Theme picker (only shown after successful signup)
  if (showThemePicker) {
    return (
      <div style={{
        width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)',
        color: 'white', padding: '24px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
          <img src="/8logo.svg" alt="8wut" style={{ width: '120px', height: '120px', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }} />
          <h2 style={{ margin: '16px 0 4px 0', fontFamily: "'Cooper Black', 'Fredoka One', cursive" }}>Welcome, {username}!</h2>
          <p style={{ opacity: 0.8, margin: 0, fontSize: '1rem' }}>Pick your vibe</p>
        </div>

        <div style={{
          width: '100%', maxWidth: '360px',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
          marginBottom: '24px'
        }}>
          {themes.map(([label, theme, bg]) => (
            <button
              key={theme}
              onClick={() => setSelectedTheme(theme)}
              style={{
                padding: '20px 12px', borderRadius: '16px',
                border: selectedTheme === theme ? '3px solid white' : '2px solid rgba(255,255,255,0.3)',
                background: bg, color: 'white', fontWeight: 'bold', fontSize: '1.1rem',
                cursor: 'pointer', fontFamily: 'inherit',
                textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                transform: selectedTheme === theme ? 'scale(1.05)' : 'scale(1)',
                transition: 'all 0.2s ease',
                boxShadow: selectedTheme === theme ? '0 4px 20px rgba(255,255,255,0.3)' : '0 2px 8px rgba(0,0,0,0.3)'
              }}
            >{label}</button>
          ))}
        </div>

        <button
          onClick={applyThemeAndEnter}
          style={{
            padding: '16px 48px', borderRadius: '16px',
            background: 'var(--color-orange)', border: 'none',
            color: 'white', fontWeight: 'bold', fontSize: '1.2rem',
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            transition: 'transform 0.2s ease'
          }}
        >Let's go →</button>
      </div>
    );
  }

  // Step 1: Sign up / Log in form
  return (
    <div style={{
      width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)',
      color: 'white', padding: '24px', overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
        <img src="/8logo.svg" alt="8wut logo" style={{ width: '180px', height: '180px', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }} />
        <p style={{ opacity: 0.8, marginTop: '12px', fontSize: '1rem' }}>Community Food Photojournaling</p>
      </div>

      <form
        onSubmit={handleAuth}
        style={{
          width: '100%', maxWidth: '360px',
          background: 'var(--color-skyblue)', padding: '28px',
          borderRadius: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          display: 'flex', flexDirection: 'column', gap: '14px'
        }}
      >
        <h2 style={{ margin: '0 0 4px 0', textAlign: 'center', color: 'white', fontSize: '1.4rem' }}>
          {isLoginView ? 'Welcome Back' : 'Create Your Account'}
        </h2>

        <input
          type="text"
          placeholder="Pick a username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          style={inputStyle}
          autoCapitalize="none"
          autoCorrect="off"
          disabled={loading}
        />

        <input
          type="password"
          placeholder="Choose a password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={inputStyle}
          disabled={loading}
        />

        {/* Honeypot — invisible to humans, bots auto-fill it */}
        <input
          type="text"
          name="website"
          value={website}
          onChange={e => setWebsite(e.target.value)}
          autoComplete="off"
          tabIndex={-1}
          style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, width: 0 }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: '4px', padding: '16px', borderRadius: '12px',
            background: loading ? 'rgba(255,183,77,0.6)' : 'var(--color-orange)',
            border: 'none', color: 'white', fontWeight: 'bold', fontSize: '1.2rem',
            cursor: loading ? 'wait' : 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)', fontFamily: 'inherit',
            transition: 'all 0.2s ease'
          }}
        >
          {loading ? '...' : isLoginView ? 'Log In' : 'Sign Up'}
        </button>

        <div style={{ textAlign: 'center', marginTop: '4px' }}>
          <button
            type="button"
            style={{ background: 'transparent', border: 'none', color: 'white', textDecoration: 'underline', cursor: 'pointer', opacity: 0.8, fontFamily: 'inherit', fontSize: '0.9rem' }}
            onClick={() => setIsLoginView(!isLoginView)}
          >
            {isLoginView ? "Don't have an account? Sign up" : "Already have an account? Log in"}
          </button>
        </div>
      </form>

      <p style={{ marginTop: '24px', opacity: 0.5, fontSize: '0.8rem', maxWidth: '300px', textAlign: 'center' }}>
        8wut — Community food photojournaling for the people who love to eat.
      </p>
    </div>
  );
}

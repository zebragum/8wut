import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import BottomNav from './components/BottomNav';
import TopBar from './components/TopBar';
import FeedView from './components/FeedView';
import ProfileView from './components/ProfileView';
import CreatePost from './components/CreatePost';
import NotificationsView from './components/NotificationsView';
import AuthView from './components/AuthView';
import AdminView from './components/AdminView';
import { AuthProvider, useAuth } from './AuthContext';
import './index.css';

function AppShell() {
  const { currentUser, loading } = useAuth();
  const [currentView, setCurrentView] = useState('feed');
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [globalTheme, setGlobalTheme] = useState(localStorage.getItem('8wut-theme') || 'theme-grass');

  useEffect(() => {
    const handleNavigate = async (e: Event) => {
      const customEvent = e as CustomEvent;
      if (typeof customEvent.detail === 'string') {
        setCurrentView(customEvent.detail);
        if (customEvent.detail === 'profile') setCurrentProfileId(null);
      } else if (typeof customEvent.detail === 'object' && customEvent.detail !== null) {
        setCurrentView(customEvent.detail.view);
        if (customEvent.detail.view === 'profile') {
          if (customEvent.detail.userId) {
            setCurrentProfileId(customEvent.detail.userId);
          } else if (customEvent.detail.username) {
            // @mention click — resolve username to userId via API
            try {
              const apiClient = (await import('./api/client')).default;
              const res = await apiClient.get(`/users/by-username/${encodeURIComponent(customEvent.detail.username)}`);
              setCurrentProfileId(res.data.id);
            } catch {
              setCurrentProfileId(null);
            }
          } else {
            setCurrentProfileId(null);
          }
        }
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleThemeChange = (e: Event) => {
      const themeEvent = e as CustomEvent;
      setGlobalTheme(themeEvent.detail);
      localStorage.setItem('8wut-theme', themeEvent.detail);
    };

    window.addEventListener('navigate', handleNavigate);
    window.addEventListener('change-theme', handleThemeChange);
    return () => {
      window.removeEventListener('navigate', handleNavigate);
      window.removeEventListener('change-theme', handleThemeChange);
    };
  }, []);

  useEffect(() => {
    document.body.className = '';
    document.body.classList.add(globalTheme);
  }, [globalTheme]);

  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
        <img src="/8logo.svg" alt="Loading" style={{ width: '80px', height: '80px', opacity: 0.8, animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    );
  }

  if (!currentUser) {
    return <AuthView />;
  }

  return (
    <div className={`app-shell ${globalTheme}`}>
      <div className="desktop-only-overlay">
        <h1 className="desktop-title">8wut</h1>
        <p className="desktop-subtitle">This is a mobile-first experience. Please scan the code to open 8wut on your phone!</p>
        <div className="qr-code-container">
          <img 
            src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://8wut.org" 
            alt="QR Code"
            style={{ width: '200px', height: '200px', display: 'block' }}
          />
        </div>
        <p style={{ opacity: 0.7, fontSize: '1rem', fontStyle: 'italic' }}>8wut.org</p>
      </div>
      <TopBar currentView={currentView} />
      <main className={`main-content ${currentView === 'create' ? 'create-mode' : ''}`}>
        {currentView === 'feed' && <FeedView />}
        {currentView === 'eat' && <FeedView filter="fridge" />}
        {currentView === 'create' && <CreatePost />}
        {currentView === 'notifications' && <NotificationsView />}
        {currentView === 'profile' && <ProfileView userId={currentProfileId} />}
        {currentView === 'admin' && currentUser.is_admin && <AdminView />}
      </main>
      <BottomNav currentView={currentView} onViewChange={setCurrentView} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            borderRadius: '12px',
            background: 'rgba(30,30,30,0.95)',
            color: '#fff',
            fontFamily: 'Outfit, sans-serif',
            fontSize: '0.95rem',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.15)'
          },
          success: { iconTheme: { primary: '#4fc3f7', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef5350', secondary: '#fff' } }
        }}
      />
      <AppShell />
    </AuthProvider>
  );
}

import { useEffect, useState } from 'react';

export default function Logo({ className = "", width = 80, height = 80 }: { className?: string; width?: number | string; height?: number | string }) {
  const [isRave, setIsRave] = useState(false);

  useEffect(() => {
    const checkTheme = () => setIsRave(document.body.classList.contains('theme-party'));
    checkTheme();
    
    // Listen for custom theme change events
    const handleThemeChange = (e: any) => setIsRave(e.detail === 'theme-party');
    window.addEventListener('change-theme', handleThemeChange);
    
    // Also use observer strictly for safety across re-renders
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    
    return () => {
      window.removeEventListener('change-theme', handleThemeChange);
      observer.disconnect();
    }
  }, []);

  const src = isRave ? '/8logo_rave.svg' : '/8logo.svg';
  return (
    <img
      src={src}
      alt="8wut Logo"
      className={className}
      style={{ width: `${width}px`, height: `${height}px`, objectFit: 'contain' }}
    />
  );
}

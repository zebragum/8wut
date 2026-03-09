type BottomNavProps = {
  currentView: string;
  onViewChange: (view: string) => void;
};

export default function BottomNav({ currentView, onViewChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav">
      <button 
        className={`nav-item ${currentView === 'feed' ? 'active' : ''}`}
        onClick={() => onViewChange('feed')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          {/* Home/House Icon */}
          <path d="M12 2.5C11.5 2.5 11 2.7 10.6 3.1L2.6 10.1C2.2 10.5 2 11 2 11.5L2 20C2 21.1 2.9 22 4 22L9 22L9 15L15 15L15 22L20 22C21.1 22 22 21.1 22 20L22 11.5C22 11 21.8 10.5 21.4 10.1L13.4 3.1C13 2.7 12.5 2.5 12 2.5Z" />
        </svg>
      </button>

      {currentView !== 'create' && (
        <button 
          className={`nav-item ${currentView === 'create' ? 'active' : ''}`}
          onClick={() => onViewChange('create')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            {/* Bold Thick Plus icon */}
            <path d="M19 10h-5V5h-4v5H5v4h5v5h4v-5h5v-4z" />
          </svg>
        </button>
      )}

      <button 
        className={`nav-item ${currentView === 'eat' ? 'active' : ''}`}
        onClick={() => onViewChange('eat')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          {/* Refrigerator icon */}
          <path d="M18 2.5H6C4.9 2.5 4 3.4 4 4.5V10H20V4.5C20 3.4 19.1 2.5 18 2.5ZM4 11.5V19.5C4 20.6 4.9 21.5 6 21.5H18C19.1 21.5 20 20.6 20 19.5V11.5H4ZM9 5.5H10V8.5H9V5.5ZM9 14H10V18H9V14Z" />
        </svg>
      </button>
    </nav>
  );
}

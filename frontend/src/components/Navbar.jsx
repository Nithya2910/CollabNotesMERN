import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { disconnectSocket } from '../socket/socket';

/**
 * Navbar — top navigation bar with logo, dark mode toggle, and user menu.
 */
const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dark, setDark] = useState(
    () => localStorage.getItem('cn_theme') === 'dark'
  );
  const [menuOpen, setMenuOpen] = useState(false);

  // Apply / remove "dark" class on <html> whenever dark state changes
  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
      localStorage.setItem('cn_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('cn_theme', 'light');
    }
  }, [dark]);

  // Initialise dark mode from localStorage on first paint
  useEffect(() => {
    const saved = localStorage.getItem('cn_theme');
    if (saved === 'dark') document.documentElement.classList.add('dark');
  }, []);

  const handleLogout = () => {
    disconnectSocket();
    logout();
    navigate('/login');
  };

  const isEditor = location.pathname.startsWith('/editor');

  return (
    <nav className="sticky top-0 z-50 glass border-b border-gray-200/50 dark:border-gray-700/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2 group">
            <span className="text-2xl">✦</span>
            <span className="text-xl font-bold bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">
              CollabNotes
            </span>
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Dark mode toggle */}
            <button
              id="dark-mode-toggle"
              onClick={() => setDark((d) => !d)}
              className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle dark mode"
            >
              {dark ? (
                /* Sun icon */
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                /* Moon icon */
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Dashboard link (not visible when already there) */}
            {isEditor && (
              <Link to="/dashboard" className="btn-secondary text-sm py-2 px-4">
                ← Dashboard
              </Link>
            )}

            {/* User menu */}
            {user && (
              <div className="relative">
                <button
                  id="user-menu-btn"
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-sm font-bold">
                    {user.username?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">
                    {user.username}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown */}
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 glass rounded-xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 animate-fade-in overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Signed in as</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.email}</p>
                    </div>
                    <button
                      id="logout-btn"
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

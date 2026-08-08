import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { API_URL } from './config';
import LoginSignup from './components/LoginSignup';
import Dashboard from './components/Dashboard';
import KanbanBoard from './components/KanbanBoard';
import { io } from 'socket.io-client';
import { LogOut, Layers, Bell, Check, Palette } from 'lucide-react';

const THEMES = [
  { id: 'indigo', name: 'Royal Indigo', primary: '#6366f1', secondary: '#a855f7', glowPrimary: 'rgba(99, 102, 241, 0.45)', glowSecondary: 'rgba(168, 85, 247, 0.45)' },
  { id: 'sunset', name: 'Sunset Amber', primary: '#f97316', secondary: '#ef4444', glowPrimary: 'rgba(249, 115, 22, 0.45)', glowSecondary: 'rgba(239, 68, 68, 0.45)' },
  { id: 'emerald', name: 'Emerald Teal', primary: '#10b981', secondary: '#06b6d4', glowPrimary: 'rgba(16, 185, 129, 0.45)', glowSecondary: 'rgba(6, 182, 212, 0.45)' },
  { id: 'cyberpunk', name: 'Cyberpunk Rose', primary: '#ec4899', secondary: '#d946ef', glowPrimary: 'rgba(236, 72, 153, 0.45)', glowSecondary: 'rgba(217, 70, 239, 0.45)' },
  { id: 'electric', name: 'Electric Blue', primary: '#3b82f6', secondary: '#6366f1', glowPrimary: 'rgba(59, 130, 246, 0.45)', glowSecondary: 'rgba(99, 102, 241, 0.45)' }
];

function AppContent() {
  const { user, token, loading, logout, getAuthHeaders } = useAuth();
  const [currentProject, setCurrentProject] = useState(null);
  const [socket, setSocket] = useState(null);
  
  // Theme customizer states
  const [activeTheme, setActiveTheme] = useState(localStorage.getItem('board-theme') || 'indigo');
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);

  // Notification states
  const [notifications, setNotifications] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [toast, setToast] = useState(null);

  // Apply theme when theme changes
  useEffect(() => {
    const theme = THEMES.find(t => t.id === activeTheme) || THEMES[0];
    document.documentElement.style.setProperty('--accent-primary', theme.primary);
    document.documentElement.style.setProperty('--accent-secondary', theme.secondary);
    document.documentElement.style.setProperty('--accent-primary-glow', theme.glowPrimary);
    document.documentElement.style.setProperty('--accent-secondary-glow', theme.glowSecondary);
    localStorage.setItem('board-theme', theme.id);
  }, [activeTheme]);

  // Initialize Socket.io connection when token/user is available
  useEffect(() => {
    if (token && user) {
      const socketConnection = io('http://localhost:5000');
      setSocket(socketConnection);

      socketConnection.on('connect', () => {
        console.log('Connected to WebSocket Server');
        // Join personal room to receive private alerts
        socketConnection.emit('join_user', user.id);
      });

      socketConnection.on('new_notification', (notification) => {
        console.log('Received notification:', notification);
        setNotifications((prev) => [notification, ...prev]);
        
        // Show temporary toast notification
        setToast(notification.content);
        setTimeout(() => setToast(null), 5000);
      });

      return () => {
        socketConnection.disconnect();
        console.log('Disconnected from WebSocket Server');
      };
    } else {
      setSocket(null);
    }
  }, [token, user]);

  // Fetch initial notifications
  useEffect(() => {
    if (!token) return;
    const fetchNotifications = async () => {
      try {
        const res = await fetch(`${API_URL}/notifications`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          setNotifications(data);
        }
      } catch (err) {
        console.error('Error fetching notifications:', err);
      }
    };
    fetchNotifications();
  }, [token, getAuthHeaders]);

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch(`${API_URL}/notifications/read-all`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setNotifications((prev) => prev.map(n => ({ ...n, is_read: 1 })));
      }
    } catch (err) {
      console.error('Error marking notifications read:', err);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-dark)',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(255, 255, 255, 0.1)',
            borderTopColor: 'var(--accent-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem auto'
          }} />
          <p>Initializing workspace...</p>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <LoginSignup />;
  }

  const unreadCount = notifications.filter(n => n.is_read === 0).length;

  return (
    <div>
      {/* Global Navigation Header */}
      <header className="header-glass">
        <div
          onClick={() => {
            setCurrentProject(null);
            setShowNotifDropdown(false);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}
        >
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px var(--accent-primary-glow)'
          }}>
            <Layers size={16} color="#fff" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '1.2rem', letterSpacing: '-0.5px' }}>
            Board<span style={{ color: 'var(--accent-primary)' }}>Sync</span>
          </span>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          
          {/* Theme Customizer Palette */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowThemeDropdown(!showThemeDropdown);
                setShowNotifDropdown(false);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: showThemeDropdown ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.2s'
              }}
              title="Customize workspace theme"
            >
              <Palette size={20} />
            </button>

            {showThemeDropdown && (
              <div className="glass-panel animate-fade-in" style={{
                position: 'absolute',
                top: '40px',
                right: 0,
                width: '200px',
                zIndex: 1000,
                padding: '0.75rem',
                boxShadow: 'var(--shadow-lg)',
                background: 'rgba(15, 23, 42, 0.98)',
                border: '1px solid var(--glass-border-hover)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', paddingBottom: '0.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Workspace Themes
                </span>
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTheme(theme.id);
                      setShowThemeDropdown(false);
                    }}
                    style={{
                      background: activeTheme === theme.id ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                      border: '1px solid',
                      borderColor: activeTheme === theme.id ? 'var(--accent-primary)' : 'transparent',
                      borderRadius: '6px',
                      color: activeTheme === theme.id ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: '0.4rem 0.6rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      fontSize: '0.8rem',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                      width: '100%'
                    }}
                  >
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                      boxShadow: `0 0 6px ${theme.glowPrimary}`
                    }} />
                    {theme.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Notification Bell */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              style={{
                background: 'none',
                border: 'none',
                color: showNotifDropdown ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '0.5rem',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.2s'
              }}
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  background: 'var(--priority-high)',
                  color: '#fff',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  width: '15px',
                  height: '15px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 8px var(--priority-high)'
                }}>
                  {unreadCount}
                </div>
              )}
            </button>

            {/* Notification Dropdown Drawer */}
            {showNotifDropdown && (
              <div className="glass-panel animate-fade-in" style={{
                position: 'absolute',
                top: '40px',
                right: 0,
                width: '320px',
                zIndex: 1000,
                padding: '0.75rem',
                boxShadow: 'var(--shadow-lg)',
                background: 'rgba(15, 23, 42, 0.98)',
                border: '1px solid var(--glass-border-hover)'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: '0.5rem',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  marginBottom: '0.5rem'
                }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-primary)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}
                    >
                      <Check size={12} /> Mark all read
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {notifications.length === 0 ? (
                    <p style={{ padding: '2rem 0', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      No alerts yet.
                    </p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        style={{
                          padding: '0.6rem',
                          borderRadius: '6px',
                          background: n.is_read === 0 ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.02)',
                          border: n.is_read === 0 ? '1px solid rgba(99, 102, 241, 0.15)' : '1px solid transparent',
                          fontSize: '0.8rem',
                          lineHeight: '1.3'
                        }}
                      >
                        <p style={{ color: '#e2e8f0', marginBottom: '0.25rem' }}>{n.content}</p>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {new Date(n.created_at).toLocaleDateString()} at {new Date(n.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User profile info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="avatar" style={{ width: '28px', height: '28px', fontSize: '0.8rem' }}>
              {user.username[0]}
            </div>
            <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>
              {user.username}
            </span>
          </div>

          <button
            className="btn-secondary"
            onClick={() => {
              setCurrentProject(null);
              setShowNotifDropdown(false);
              logout();
            }}
            style={{
              padding: '0.4rem 0.8rem',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              height: '32px'
            }}
          >
            <LogOut size={13} />
            Logout
          </button>
        </div>
      </header>

      {/* Main Workspace Router */}
      <main>
        {currentProject ? (
          <KanbanBoard
            project={currentProject}
            onBack={() => setCurrentProject(null)}
            socket={socket}
          />
        ) : (
          <Dashboard onSelectProject={setCurrentProject} />
        )}
      </main>

      {/* Real-time Toast Notifications Alert */}
      {toast && (
        <div className="alert-banner animate-fade-in" style={{
          border: '1px solid var(--accent-primary)',
          boxShadow: '0 0 20px var(--accent-primary-glow)'
        }}>
          <div className="avatar" style={{ width: '22px', height: '22px', fontSize: '0.7rem' }}>✦</div>
          <div style={{ fontSize: '0.85rem' }}>{toast}</div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

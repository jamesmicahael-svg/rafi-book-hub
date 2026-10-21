import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from '../ui/Avatar';
import { supabase } from '../../lib/supabase';
import type { Notification } from '../../lib/types';
import { timeAgo } from '../../lib/utils';

export function Navbar() {
  const { profile, signOut } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
  );
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!profile) return;
    loadNotifs();
    const ch = supabase
      .channel('notif-nav')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, () => loadNotifs())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function loadNotifs() {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(*)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(15);
    setNotifs((data as Notification[]) || []);
    setUnread(((data as Notification[]) || []).filter((n) => !n.read).length);
  }

  async function openNotifs() {
    setNotifOpen((v) => !v);
    setMenuOpen(false);
    if (unread > 0) {
      await supabase.from('notifications').update({ read: true }).eq('user_id', profile!.id).eq('read', false);
      setUnread(0);
    }
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) {
      nav(`/search?q=${encodeURIComponent(q.trim())}`);
      setQ('');
    }
  }

  return (
    <nav className="nav">
      <Link to="/" className="nav-brand" aria-label="Rafi Book home">Rafi</Link>
      <form onSubmit={onSearch} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <input
          className="nav-search"
          placeholder="Search Rafi Book"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search"
        />
      </form>
      <div className="nav-actions" ref={menuRef}>
        <button className="icon-btn" onClick={() => nav('/messages')} title="Messages" aria-label="Messages">💬</button>
        <div className="dropdown">
          <button className="icon-btn" onClick={openNotifs} title="Notifications" aria-label="Notifications">
            🔔{unread > 0 && <span className="badge">{unread > 99 ? '99+' : unread}</span>}
          </button>
          {notifOpen && (
            <div className="dropdown-menu" style={{ minWidth: 340, maxHeight: 420, overflowY: 'auto' }}>
              {notifs.length === 0 && <div style={{ padding: 16 }} className="muted">No notifications</div>}
              {notifs.map((n) => (
                <Link
                  key={n.id}
                  to={n.type === 'friend_request' ? '/friends' : n.type === 'message' ? '/messages' : '/'}
                  className={n.read ? '' : 'notif-unread'}
                  style={{ alignItems: 'flex-start' }}
                  onClick={() => setNotifOpen(false)}
                >
                  <Avatar url={n.actor?.avatar_url} name={n.actor?.display_name || '?'} size={36} />
                  <div>
                    <div><b>{n.actor?.display_name || 'Someone'}</b> {notifText(n.type)}</div>
                    <div className="muted">{timeAgo(n.created_at)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="dropdown">
          <button onClick={() => { setMenuOpen((v) => !v); setNotifOpen(false); }} aria-label="Account menu">
            <Avatar url={profile?.avatar_url} name={profile?.display_name || '?'} size={36} />
          </button>
          {menuOpen && (
            <div className="dropdown-menu">
              <Link to={`/profile/${profile?.username}`} onClick={() => setMenuOpen(false)}>
                <Avatar url={profile?.avatar_url} name={profile?.display_name || '?'} size={28} />
                {profile?.display_name}
              </Link>
              <Link to="/settings" onClick={() => setMenuOpen(false)}>⚙️ Settings</Link>
              {profile?.is_admin && <Link to="/admin" onClick={() => setMenuOpen(false)}>🛡️ Admin</Link>}
              <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
                {theme === 'light' ? '🌙 Dark mode' : '☀️ Light mode'}
              </button>
              <div className="dropdown-divider" />
              <button onClick={async () => { await signOut(); nav('/login'); }}>🚪 Log out</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

function notifText(t: Notification['type']): string {
  switch (t) {
    case 'friend_request': return 'sent you a friend request';
    case 'friend_accept': return 'accepted your friend request';
    case 'comment': return 'commented on your post';
    case 'reaction': return 'reacted to your post';
    case 'follow': return 'started following you';
    case 'message': return 'sent you a message';
    default: return 'interacted with you';
  }
}

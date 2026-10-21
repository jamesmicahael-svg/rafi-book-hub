import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Post, Profile, Report } from '../../lib/types';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Spinner, Empty } from '../../components/ui/Feedback';
import { timeAgo } from '../../lib/utils';

type AdminTab = 'reports' | 'users' | 'posts';

export function AdminPage() {
  const { profile: me } = useAuth();
  const [tab, setTab] = useState<AdminTab>('reports');
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, posts: 0, openReports: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    const [u, p, r] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('posts').select('*, author:profiles!posts_author_id_fkey(*)').order('created_at', { ascending: false }).limit(50),
      supabase.from('reports').select('*, reporter:profiles!reports_reporter_id_fkey(*)').order('created_at', { ascending: false }),
    ]);
    setUsers((u.data as Profile[]) || []);
    setPosts((p.data as Post[]) || []);
    setReports((r.data as Report[]) || []);
    setStats({
      users: u.data?.length ?? 0,
      posts: p.data?.length ?? 0,
      openReports: (r.data || []).filter((x) => x.status === 'open').length,
    });
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (!me?.is_admin) {
    return (
      <div className="page center" style={{ padding: 60 }}>
        <div style={{ fontSize: '3rem' }}>🛡️</div>
        <h2>Admins only</h2>
        <p className="muted">You don't have access to this area.</p>
        <Link to="/"><Button style={{ marginTop: 12 }}>Back home</Button></Link>
      </div>
    );
  }

  async function resolveReport(id: string, status: 'resolved' | 'dismissed') {
    await supabase.from('reports').update({ status }).eq('id', id);
    load();
  }

  async function deletePost(id: string) {
    if (!confirm('Delete this post permanently?')) return;
    await supabase.from('posts').delete().eq('id', id);
    load();
  }

  async function banUser(id: string) {
    if (!confirm('Set this user private and delete their recent posts?')) return;
    await supabase.from('profiles').update({ is_private: true }).eq('id', id);
    await supabase.from('posts').delete().eq('author_id', id);
    load();
  }

  async function makeAdmin(id: string) {
    if (!confirm('Grant admin rights to this user?')) return;
    await supabase.from('profiles').update({ is_admin: true }).eq('id', id);
    load();
  }

  if (loading) return <div className="page"><Spinner /></div>;

  return (
    <div className="page page-wide">
      <h1 style={{ marginBottom: 12 }}>Admin panel</h1>
      <div className="row wrap" style={{ gap: 12, marginBottom: 16 }}>
        <div className="card card-pad" style={{ flex: 1, minWidth: 140, textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{stats.users}</div>
          <div className="muted">Users</div>
        </div>
        <div className="card card-pad" style={{ flex: 1, minWidth: 140, textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{stats.posts}</div>
          <div className="muted">Recent posts</div>
        </div>
        <div className="card card-pad" style={{ flex: 1, minWidth: 140, textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: stats.openReports ? 'var(--danger)' : 'inherit' }}>{stats.openReports}</div>
          <div className="muted">Open reports</div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>Reports ({reports.filter((r) => r.status === 'open').length})</button>
        <button className={`tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>Users</button>
        <button className={`tab ${tab === 'posts' ? 'active' : ''}`} onClick={() => setTab('posts')}>Posts</button>
      </div>

      {tab === 'reports' && (
        <div className="card">
          {reports.length === 0 ? <Empty message="No reports." /> : reports.map((r) => (
            <div key={r.id} className="list-item" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
              <div className="row between" style={{ width: '100%' }}>
                <div>
                  <b>{r.target_type}</b> reported by @{r.reporter?.username} · <span className={`chip`} style={r.status === 'open' ? { color: 'var(--danger)' } : {}}>{r.status}</span>
                  <div className="muted">{timeAgo(r.created_at)}</div>
                </div>
                {r.status === 'open' && (
                  <div className="row" style={{ gap: 6 }}>
                    <Button size="sm" onClick={() => resolveReport(r.id, 'resolved')}>Resolve</Button>
                    <Button size="sm" variant="secondary" onClick={() => resolveReport(r.id, 'dismissed')}>Dismiss</Button>
                  </div>
                )}
              </div>
              <div style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 6, fontSize: '0.9rem' }}>{r.reason}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'users' && (
        <div className="card">
          {users.map((u) => (
            <div key={u.id} className="list-item">
              <Avatar url={u.avatar_url} name={u.display_name} size={40} />
              <div style={{ flex: 1 }}>
                <Link to={`/profile/${u.username}`} style={{ fontWeight: 700 }}>{u.display_name}</Link>
                <div className="muted">@{u.username}{u.is_admin && ' · admin'}{u.is_private && ' · private'}</div>
              </div>
              {!u.is_admin && (
                <div className="row" style={{ gap: 6 }}>
                  <Button size="sm" variant="secondary" onClick={() => makeAdmin(u.id)}>Make admin</Button>
                  <Button size="sm" variant="danger" onClick={() => banUser(u.id)}>Restrict</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'posts' && (
        <div className="card">
          {posts.length === 0 ? <Empty message="No posts." /> : posts.map((p) => (
            <div key={p.id} className="list-item" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 6 }}>
              <div className="row between" style={{ width: '100%' }}>
                <div className="row">
                  <Avatar url={p.author?.avatar_url} name={p.author?.display_name || '?'} size={32} />
                  <div>
                    <b>{p.author?.display_name}</b>
                    <div className="muted">{timeAgo(p.created_at)} · {p.visibility}</div>
                  </div>
                </div>
                <Button size="sm" variant="danger" onClick={() => deletePost(p.id)}>Delete</Button>
              </div>
              {p.body && <div style={{ fontSize: '0.9rem' }}>{p.body.slice(0, 300)}{p.body.length > 300 && '…'}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

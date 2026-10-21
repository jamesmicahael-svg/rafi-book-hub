import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Group, Post } from '../../lib/types';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Textarea, Select } from '../../components/ui/Form';
import { Spinner, Empty } from '../../components/ui/Feedback';
import { PostCard } from '../feed/PostCard';

export function GroupsPage() {
  const { profile: me } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [tab, setTab] = useState<'discover' | 'mine'>('discover');
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', description: '', visibility: 'public' });

  const load = useCallback(async () => {
    if (!me) return;
    setLoading(true);
    const { data: all } = await supabase.from('groups').select('*').order('created_at', { ascending: false });
    const rows = (all as Group[]) || [];
    const withMeta = await Promise.all(rows.map(async (g) => {
      const { count } = await supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', g.id).eq('status', 'approved');
      const { data: mine } = await supabase.from('group_members').select('*').eq('group_id', g.id).eq('user_id', me.id).maybeSingle();
      return { ...g, member_count: count ?? 0, my_role: mine?.role, my_status: mine?.status };
    }));
    setGroups(withMeta);
    setLoading(false);
  }, [me]);

  useEffect(() => { load(); }, [load]);

  async function createGroup() {
    if (!me || !form.name.trim()) return;
    const { data, error } = await supabase
      .from('groups')
      .insert({
        name: form.name.trim(),
        description: form.description.trim(),
        visibility: form.visibility as 'public' | 'private',
        owner_id: me.id,
      })
      .select('*')
      .single();
    if (error) return alert(error.message);
    await supabase.from('group_members').insert({
      group_id: (data as Group).id,
      user_id: me.id,
      role: 'admin',
      status: 'approved',
    });
    setCreateOpen(false);
    setForm({ name: '', description: '', visibility: 'public' });
    load();
  }

  async function join(g: Group) {
    if (!me) return;
    await supabase.from('group_members').upsert({
      group_id: g.id,
      user_id: me.id,
      role: 'member',
      status: g.visibility === 'public' ? 'approved' : 'pending',
    });
    load();
  }

  const visible = groups.filter((g) => (tab === 'mine' ? g.my_status === 'approved' : g.visibility === 'public' || g.my_status === 'approved'));

  if (loading) return <div className="page"><Spinner /></div>;

  return (
    <div className="page">
      <div className="card card-pad">
        <div className="row between">
          <div className="card-title" style={{ marginBottom: 0 }}>Groups</div>
          <Button onClick={() => setCreateOpen(true)}>➕ Create group</Button>
        </div>
        <div className="tabs" style={{ marginTop: 12, marginBottom: 0, border: 'none' }}>
          <button className={`tab ${tab === 'discover' ? 'active' : ''}`} onClick={() => setTab('discover')}>Discover</button>
          <button className={`tab ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>My groups</button>
        </div>
      </div>

      <div className="card">
        {visible.length === 0 ? <Empty message={tab === 'mine' ? "You haven't joined any groups yet." : 'No groups found.'} /> : visible.map((g) => (
          <div key={g.id} className="list-item">
            <Avatar url={g.avatar_url} name={g.name} size={48} />
            <div style={{ flex: 1 }}>
              <Link to={`/groups/${g.id}`} style={{ fontWeight: 700 }}>{g.name}</Link>
              <div className="muted">{g.visibility === 'private' ? '🔒 Private' : '🌍 Public'} · {g.member_count} members</div>
              {g.description && <div style={{ fontSize: '0.85rem' }}>{g.description}</div>}
            </div>
            {g.my_status === 'approved' ? (
              <Link to={`/groups/${g.id}`}><Button size="sm" variant="secondary">View</Button></Link>
            ) : g.my_status === 'pending' ? (
              <span className="chip">Pending</span>
            ) : (
              <Button size="sm" onClick={() => join(g)}>Join</Button>
            )}
          </div>
        ))}
      </div>

      <Modal
        open={createOpen}
        title="Create group"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createGroup} disabled={!form.name.trim()}>Create</Button>
          </>
        }
      >
        <Input label="Group name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} required />
        <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What's this group about?" />
        <Select label="Visibility" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
          <option value="public">Public — anyone can find and join</option>
          <option value="private">Private — members approved by admins</option>
        </Select>
      </Modal>
    </div>
  );
}

export function GroupDetailPage({ id }: { id: string }) {
  const { profile: me } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [tab, setTab] = useState<'feed' | 'members'>('feed');
  const [members, setMembers] = useState<Array<{ user_id: string; role: string; profile: { display_name: string; username: string; avatar_url: string } | null }>>([]);

  const load = useCallback(async () => {
    if (!me) return;
    const { data: g } = await supabase.from('groups').select('*').eq('id', id).maybeSingle();
    setGroup((g as Group) ?? null);
    if (g) {
      const { data: m } = await supabase
        .from('group_members')
        .select('user_id, role, profile:profiles(*)')
        .eq('group_id', id)
        .eq('status', 'approved');
      setMembers((m as unknown as typeof members) || []);
      const { data: p } = await supabase
        .from('posts')
        .select('*, author:profiles!posts_author_id_fkey(*), reactions_count:reactions(count), comments_count:comments(count), shares_count:shares(count)')
        .eq('group_id', id)
        .order('created_at', { ascending: false })
        .limit(50);
      setPosts(((p as unknown as Post[]) || []).map((x) => ({
        ...x,
        my_reaction: null,
        reactions_count: x.reactions_count as unknown as number,
        comments_count: x.comments_count as unknown as number,
        shares_count: x.shares_count as unknown as number,
      })));
    }
    setLoading(false);
  }, [id, me]);

  useEffect(() => { load(); }, [load]);

  async function post() {
    if (!me || !body.trim()) return;
    await supabase.from('posts').insert({
      author_id: me.id,
      body: body.trim(),
      visibility: 'public',
      group_id: id,
    });
    setBody('');
    load();
  }

  if (loading) return <div className="page"><Spinner /></div>;
  if (!group) return <div className="page"><Empty message="Group not found" /></div>;

  return (
    <div className="page">
      <div className="card">
        <div className="cover" style={{ height: 140 }} />
        <div className="card-pad">
          <h1>{group.name}</h1>
          <div className="muted">{group.visibility === 'private' ? '🔒 Private group' : '🌍 Public group'} · {members.length} members</div>
          {group.description && <p style={{ marginTop: 8 }}>{group.description}</p>}
          <div className="tabs" style={{ marginTop: 14, marginBottom: 0 }}>
            <button className={`tab ${tab === 'feed' ? 'active' : ''}`} onClick={() => setTab('feed')}>Discussion</button>
            <button className={`tab ${tab === 'members' ? 'active' : ''}`} onClick={() => setTab('members')}>Members</button>
          </div>
        </div>
      </div>

      {tab === 'feed' && (
        <>
          <div className="card card-pad">
            <div className="row">
              <Avatar url={me?.avatar_url} name={me?.display_name || '?'} size={40} />
              <input
                className="input"
                placeholder="Write to this group…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && post()}
                style={{ borderRadius: 20 }}
              />
              <Button onClick={post} disabled={!body.trim()}>Post</Button>
            </div>
          </div>
          {posts.length === 0 ? <Empty message="No posts in this group yet." /> : posts.map((p) => <PostCard key={p.id} post={p} onChanged={load} />)}
        </>
      )}

      {tab === 'members' && (
        <div className="card">
          {members.map((m) => (
            <div key={m.user_id} className="list-item">
              <Avatar url={m.profile?.avatar_url} name={m.profile?.display_name || '?'} size={40} />
              <div style={{ flex: 1 }}>
                <Link to={`/profile/${m.profile?.username}`} style={{ fontWeight: 700 }}>{m.profile?.display_name}</Link>
                <div className="muted">@{m.profile?.username}</div>
              </div>
              {m.role !== 'member' && <span className="chip">{m.role}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

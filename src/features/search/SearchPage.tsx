import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Group, Post, Profile } from '../../lib/types';
import { Avatar } from '../../components/ui/Avatar';
import { Spinner, Empty } from '../../components/ui/Feedback';
import { PostCard } from '../feed/PostCard';

type SearchTab = 'people' | 'posts' | 'groups';

export function SearchPage() {
  const { profile: me } = useAuth();
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const [tab, setTab] = useState<SearchTab>('people');
  const [people, setPeople] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async () => {
    if (!q.trim()) return;
    setLoading(true);
    const like = `%${q.trim()}%`;
    const [ppl, pst, grp] = await Promise.all([
      supabase.from('profiles').select('*').or(`display_name.ilike.${like},username.ilike.${like}`).limit(20),
      supabase
        .from('posts')
        .select('*, author:profiles!posts_author_id_fkey(*), reactions_count:reactions(count), comments_count:comments(count), shares_count:shares(count)')
        .ilike('body', like)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('groups').select('*').or(`name.ilike.${like},description.ilike.${like}`).eq('visibility', 'public').limit(20),
    ]);
    setPeople((ppl.data as Profile[]) || []);
    setPosts(((pst.data as unknown as Post[]) || []).map((x) => ({
      ...x,
      my_reaction: null,
      reactions_count: x.reactions_count as unknown as number,
      comments_count: x.comments_count as unknown as number,
      shares_count: x.shares_count as unknown as number,
    })));
    setGroups((grp.data as Group[]) || []);
    setLoading(false);
  }, [q]);

  useEffect(() => { void search(); }, [search]);

  return (
    <div className="page">
      <h1 style={{ marginBottom: 4 }}>Search results for “{q}”</h1>
      <div className="tabs">
        <button className={`tab ${tab === 'people' ? 'active' : ''}`} onClick={() => setTab('people')}>People ({people.length})</button>
        <button className={`tab ${tab === 'posts' ? 'active' : ''}`} onClick={() => setTab('posts')}>Posts ({posts.length})</button>
        <button className={`tab ${tab === 'groups' ? 'active' : ''}`} onClick={() => setTab('groups')}>Groups ({groups.length})</button>
      </div>

      {loading ? <Spinner /> : (
        <>
          {tab === 'people' && (
            <div className="card">
              {people.length === 0 ? <Empty message="No people found." /> : people.map((p) => (
                <div key={p.id} className="list-item">
                  <Avatar url={p.avatar_url} name={p.display_name} size={48} />
                  <div style={{ flex: 1 }}>
                    <Link to={`/profile/${p.username}`} style={{ fontWeight: 700 }}>{p.display_name}</Link>
                    <div className="muted">@{p.username}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {tab === 'posts' && (posts.length === 0 ? <Empty message="No posts found." /> : posts.map((p) => <PostCard key={p.id} post={p} onChanged={search} />))}
          {tab === 'groups' && (
            <div className="card">
              {groups.length === 0 ? <Empty message="No groups found." /> : groups.map((g) => (
                <div key={g.id} className="list-item">
                  <Avatar url={g.avatar_url} name={g.name} size={48} />
                  <div style={{ flex: 1 }}>
                    <Link to={`/groups/${g.id}`} style={{ fontWeight: 700 }}>{g.name}</Link>
                    <div className="muted">{g.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {!me && null}
    </div>
  );
}

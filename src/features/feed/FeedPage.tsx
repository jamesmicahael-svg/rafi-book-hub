import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Post } from '../../lib/types';
import { PostCard } from './PostCard';
import { PostComposer } from './PostComposer';
import { Spinner, Empty } from '../../components/ui/Feedback';
import { StoryTray } from '../stories/StoryTray';

export function FeedPage() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('posts')
      .select('*, author:profiles!posts_author_id_fkey(*), reactions_count:reactions(count), comments_count:comments(count), shares_count:shares(count)')
      .is('group_id', null)
      .order('created_at', { ascending: false })
      .limit(50);
    let rows = (data as unknown as Post[]) || [];
    // attach my reaction
    const { data: mine } = await supabase
      .from('reactions')
      .select('post_id, type')
      .eq('user_id', profile.id);
    const mineMap = new Map((mine || []).map((r) => [r.post_id, r.type]));
    rows = rows.map((p) => ({
      ...p,
      my_reaction: mineMap.get(p.id) ?? null,
      reactions_count: p.reactions_count as unknown as number,
      comments_count: p.comments_count as unknown as number,
      shares_count: p.shares_count as unknown as number,
    }));
    setPosts(rows);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
    if (!profile) return;
    const ch = supabase
      .channel('feed-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, profile]);

  if (loading) return <div className="page"><Spinner /></div>;

  return (
    <div className="page">
      <StoryTray onChanged={load} />
      <PostComposer onPosted={load} />
      {posts.length === 0 ? (
        <Empty message="No posts yet. Be the first to share something!" />
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} onChanged={load} />)
      )}
    </div>
  );
}

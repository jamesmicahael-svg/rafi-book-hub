import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Post, Profile } from '../../lib/types';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Spinner, Empty } from '../../components/ui/Feedback';
import { PostCard } from '../feed/PostCard';
import { PostComposer } from '../feed/PostComposer';
import { timeAgo } from '../../lib/utils';

export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { profile: me } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending_sent' | 'pending_recv' | 'friends'>('none');
  const [mutual, setMutual] = useState(0);

  const load = useCallback(async () => {
    if (!username || !me) return;
    setLoading(true);
    const { data: p } = await supabase.from('profiles').select('*').eq('username', username).single();
    setProfile((p as Profile) ?? null);
    if (p) {
      const { data: postData } = await supabase
        .from('posts')
        .select('*, author:profiles!posts_author_id_fkey(*), reactions_count:reactions(count), comments_count:comments(count), shares_count:shares(count)')
        .eq('author_id', p.id)
        .in('visibility', me.id === p.id ? ['public', 'friends', 'private'] : ['public', 'friends'])
        .order('created_at', { ascending: false })
        .limit(30);
      setPosts(((postData as unknown as Post[]) || []).map((x) => ({
        ...x,
        my_reaction: null,
        reactions_count: x.reactions_count as unknown as number,
        comments_count: x.comments_count as unknown as number,
        shares_count: x.shares_count as unknown as number,
      })));

      if (p.id !== me.id) {
        const a = me.id < p.id ? me.id : p.id;
        const b = me.id < p.id ? p.id : me.id;
        const { data: fr } = await supabase.from('friendships').select('*').eq('user_id', a).eq('friend_id', b).maybeSingle();
        if (fr) setFriendStatus('friends');
        else {
          const { data: req } = await supabase
            .from('friend_requests')
            .select('*')
            .or(`and(sender_id.eq.${me.id},receiver_id.eq.${p.id}),and(sender_id.eq.${p.id},receiver_id.eq.${me.id})`)
            .eq('status', 'pending')
            .maybeSingle();
          if (req) setFriendStatus(req.sender_id === me.id ? 'pending_sent' : 'pending_recv');
          else setFriendStatus('none');
        }
        const { count: mutualA } = await supabase
          .from('friendships')
          .select('*', { count: 'exact', head: true })
          .or(`user_id.eq.${me.id},friend_id.eq.${me.id}`);
        const { count: mutualB } = await supabase
          .from('friendships')
          .select('*', { count: 'exact', head: true })
          .or(`user_id.eq.${p.id},friend_id.eq.${p.id}`);
        setMutual(Math.min(mutualA ?? 0, mutualB ?? 0));
      }
    }
    setLoading(false);
  }, [username, me]);

  useEffect(() => { load(); }, [load]);

  async function sendRequest() {
    if (!profile || !me) return;
    await supabase.from('friend_requests').insert({ sender_id: me.id, receiver_id: profile.id });
    setFriendStatus('pending_sent');
    await supabase.from('notifications').insert({
      user_id: profile.id,
      actor_id: me.id,
      type: 'friend_request',
      entity_id: me.id,
    });
  }

  async function acceptRequest() {
    if (!profile || !me) return;
    const { data: req } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('sender_id', profile.id)
      .eq('receiver_id', me.id)
      .eq('status', 'pending')
      .single();
    if (!req) return;
    await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', req.id);
    const a = me.id < profile.id ? me.id : profile.id;
    const b = me.id < profile.id ? profile.id : me.id;
    await supabase.from('friendships').insert({ user_id: a, friend_id: b });
    await supabase.from('notifications').insert({
      user_id: profile.id,
      actor_id: me.id,
      type: 'friend_accept',
      entity_id: me.id,
    });
    setFriendStatus('friends');
  }

  async function unfriend() {
    if (!profile || !me) return;
    if (!confirm(`Unfriend ${profile.display_name}?`)) return;
    const a = me.id < profile.id ? me.id : profile.id;
    const b = me.id < profile.id ? profile.id : me.id;
    await supabase.from('friendships').delete().eq('user_id', a).eq('friend_id', b);
    setFriendStatus('none');
  }

  async function toggleFollow() {
    if (!profile || !me) return;
    const { data } = await supabase
      .from('follows')
      .select('*')
      .eq('follower_id', me.id)
      .eq('following_id', profile.id)
      .maybeSingle();
    if (data) {
      await supabase.from('follows').delete().eq('follower_id', me.id).eq('following_id', profile.id);
    } else {
      await supabase.from('follows').insert({ follower_id: me.id, following_id: profile.id });
      if (profile.id !== me.id) {
        await supabase.from('notifications').insert({
          user_id: profile.id, actor_id: me.id, type: 'follow', entity_id: me.id,
        });
      }
    }
  }

  if (loading) return <div className="page"><Spinner /></div>;
  if (!profile) return <div className="page"><Empty message="Profile not found" /></div>;

  const isMe = me?.id === profile.id;

  return (
    <div className="page">
      <div className="card">
        <div className="cover" style={profile.cover_url ? { backgroundImage: `url(${profile.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}} />
        <div className="card-pad" style={{ paddingBottom: 8 }}>
          <div className="row" style={{ alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <Avatar url={profile.avatar_url} name={profile.display_name} size={140} />
            <div className="row" style={{ gap: 8, paddingBottom: 12 }}>
              {isMe ? (
                <a href="/settings"><Button variant="secondary">Edit profile</Button></a>
              ) : (
                <>
                  {friendStatus === 'none' && <Button onClick={sendRequest}>➕ Add friend</Button>}
                  {friendStatus === 'pending_sent' && <Button variant="secondary" disabled>Request sent</Button>}
                  {friendStatus === 'pending_recv' && <Button onClick={acceptRequest}>✅ Accept request</Button>}
                  {friendStatus === 'friends' && <Button variant="secondary" onClick={unfriend}>Unfriend</Button>}
                  <Button variant="secondary" onClick={toggleFollow}>Follow</Button>
                </>
              )}
            </div>
          </div>
          <h1 style={{ fontSize: '1.5rem', marginTop: 12 }}>{profile.display_name}</h1>
          <div className="muted">@{profile.username}{friendStatus === 'friends' && ' · Friends'}{mutual > 0 && ` · ${mutual} mutual friends`}</div>
          {profile.bio && <p style={{ marginTop: 10 }}>{profile.bio}</p>}
          <div className="row wrap muted" style={{ marginTop: 10, gap: 16 }}>
            {profile.work && <span>💼 {profile.work}</span>}
            {profile.education && <span>🎓 {profile.education}</span>}
            {profile.location && <span>📍 {profile.location}</span>}
            {profile.website && <a href={profile.website} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>🔗 {profile.website}</a>}
            <span>📅 Joined {timeAgo(profile.created_at)}</span>
          </div>
        </div>
      </div>

      {isMe && <PostComposer onPosted={load} />}

      <h2 style={{ margin: '16px 0 8px' }}>Posts</h2>
      {posts.length === 0 ? (
        <Empty message={isMe ? "You haven't posted anything yet." : 'No posts to show.'} />
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} onChanged={load} />)
      )}
    </div>
  );
}

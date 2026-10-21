import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { FriendRequest, Profile } from '../../lib/types';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Spinner, Empty } from '../../components/ui/Feedback';

type Tab = 'requests' | 'friends' | 'suggestions';

export function FriendsPage() {
  const { profile: me } = useAuth();
  const [tab, setTab] = useState<Tab>('friends');
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!me) return;
    setLoading(true);
    const { data: reqs } = await supabase
      .from('friend_requests')
      .select('*, sender:profiles!friend_requests_sender_id_fkey(*)')
      .eq('receiver_id', me.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setRequests((reqs as FriendRequest[]) || []);

    const { data: rels } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .or(`user_id.eq.${me.id},friend_id.eq.${me.id}`);
    const ids = (rels || []).map((r) => (r.user_id === me.id ? r.friend_id : r.user_id));
    if (ids.length) {
      const { data: fps } = await supabase.from('profiles').select('*').in('id', ids).order('display_name');
      setFriends((fps as Profile[]) || []);
      const { data: sugg } = await supabase
        .from('profiles')
        .select('*')
        .not('id', 'in', `(${[me.id, ...ids].join(',')})`)
        .order('created_at', { ascending: false })
        .limit(10);
      setSuggestions((sugg as Profile[]) || []);
    } else {
      setFriends([]);
      const { data: sugg } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', me.id)
        .order('created_at', { ascending: false })
        .limit(10);
      setSuggestions((sugg as Profile[]) || []);
    }
    setLoading(false);
  }, [me]);

  useEffect(() => { load(); }, [load]);

  async function accept(req: FriendRequest) {
    if (!me) return;
    await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', req.id);
    const a = me.id < req.sender_id ? me.id : req.sender_id;
    const b = me.id < req.sender_id ? req.sender_id : me.id;
    await supabase.from('friendships').insert({ user_id: a, friend_id: b });
    await supabase.from('notifications').insert({
      user_id: req.sender_id, actor_id: me.id, type: 'friend_accept', entity_id: me.id,
    });
    load();
  }

  async function reject(req: FriendRequest) {
    await supabase.from('friend_requests').update({ status: 'rejected' }).eq('id', req.id);
    load();
  }

  async function addSuggestion(p: Profile) {
    if (!me) return;
    await supabase.from('friend_requests').insert({ sender_id: me.id, receiver_id: p.id });
    await supabase.from('notifications').insert({
      user_id: p.id, actor_id: me.id, type: 'friend_request', entity_id: me.id,
    });
    setSuggestions((s) => s.filter((x) => x.id !== p.id));
  }

  if (loading) return <div className="page"><Spinner /></div>;

  return (
    <div className="page">
      <div className="card card-pad">
        <div className="card-title">Friends</div>
        <div className="tabs" style={{ marginBottom: 0, border: 'none' }}>
          <button className={`tab ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
            Requests {requests.length > 0 && <span className="badge" style={{ position: 'static' }}>{requests.length}</span>}
          </button>
          <button className={`tab ${tab === 'friends' ? 'active' : ''}`} onClick={() => setTab('friends')}>Friends ({friends.length})</button>
          <button className={`tab ${tab === 'suggestions' ? 'active' : ''}`} onClick={() => setTab('suggestions')}>Suggestions</button>
        </div>
      </div>

      {tab === 'requests' && (
        <div className="card">
          {requests.length === 0 ? <Empty message="No pending friend requests." /> : requests.map((r) => (
            <div key={r.id} className="list-item">
              <Avatar url={r.sender?.avatar_url} name={r.sender?.display_name || '?'} size={48} />
              <div style={{ flex: 1 }}>
                <Link to={`/profile/${r.sender?.username}`} style={{ fontWeight: 700 }}>{r.sender?.display_name}</Link>
                <div className="muted">@{r.sender?.username}</div>
              </div>
              <Button size="sm" onClick={() => accept(r)}>Confirm</Button>
              <Button size="sm" variant="secondary" onClick={() => reject(r)}>Delete</Button>
            </div>
          ))}
        </div>
      )}

      {tab === 'friends' && (
        <div className="card">
          {friends.length === 0 ? <Empty message="No friends yet — check Suggestions!" /> : friends.map((f) => (
            <div key={f.id} className="list-item">
              <Avatar url={f.avatar_url} name={f.display_name} size={48} />
              <div style={{ flex: 1 }}>
                <Link to={`/profile/${f.username}`} style={{ fontWeight: 700 }}>{f.display_name}</Link>
                <div className="muted">@{f.username}</div>
              </div>
              <Link to={`/messages?user=${f.username}`}><Button size="sm" variant="secondary">Message</Button></Link>
            </div>
          ))}
        </div>
      )}

      {tab === 'suggestions' && (
        <div className="card">
          {suggestions.length === 0 ? <Empty message="No suggestions right now." /> : suggestions.map((f) => (
            <div key={f.id} className="list-item">
              <Avatar url={f.avatar_url} name={f.display_name} size={48} />
              <div style={{ flex: 1 }}>
                <Link to={`/profile/${f.username}`} style={{ fontWeight: 700 }}>{f.display_name}</Link>
                <div className="muted">@{f.username}</div>
              </div>
              <Button size="sm" onClick={() => addSuggestion(f)}>➕ Add</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

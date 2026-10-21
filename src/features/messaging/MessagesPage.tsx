import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Conversation, Message, Profile } from '../../lib/types';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Spinner, Empty } from '../../components/ui/Feedback';
import { timeAgo } from '../../lib/utils';

export function MessagesPage() {
  const { profile: me } = useAuth();
  const [params] = useSearchParams();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [newChatUser, setNewChatUser] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const loadFriends = useCallback(async () => {
    if (!me) return;
    const { data: rels } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .or(`user_id.eq.${me.id},friend_id.eq.${me.id}`);
    const ids = (rels || []).map((r) => (r.user_id === me.id ? r.friend_id : r.user_id));
    if (!ids.length) {
      // fallback: show other profiles so chat still possible
      const { data: all } = await supabase.from('profiles').select('*').neq('id', me.id).limit(20);
      setFriends((all as Profile[]) || []);
      return;
    }
    const { data: fps } = await supabase.from('profiles').select('*').in('id', ids).order('display_name');
    setFriends((fps as Profile[]) || []);
  }, [me]);

  const loadConvs = useCallback(async () => {
    if (!me) return;
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .or(`user_a.eq.${me.id},user_b.eq.${me.id}`)
      .order('created_at', { ascending: false });
    const rows = (data as Conversation[]) || [];
    const enriched = await Promise.all(rows.map(async (c) => {
      const otherId = c.user_a === me.id ? c.user_b : c.user_a;
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', otherId).single();
      const { data: last } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', c.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const { count: unread } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', c.id)
        .neq('sender_id', me.id)
        .is('read_at', null);
      return { ...c, other: prof as Profile, last_message: last as Message | undefined, unread_count: unread ?? 0 };
    }));
    enriched.sort((a, b) => new Date(b.last_message?.created_at || b.created_at).getTime() - new Date(a.last_message?.created_at || a.created_at).getTime());
    setConvs(enriched);
    setLoading(false);
  }, [me]);

  useEffect(() => { loadConvs(); loadFriends(); }, [loadConvs, loadFriends]);

  // open from ?user=username
  useEffect(() => {
    const u = params.get('user');
    if (u && me) void startChatByUsername(u);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, me]);

  async function loadMessages(conv: Conversation) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true });
    setMessages((data as Message[]) || []);
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conv.id)
      .neq('sender_id', me!.id)
      .is('read_at', null);
  }

  useEffect(() => {
    if (!active || !me) return;
    void loadMessages(active);
    const ch = supabase
      .channel(`conv_${active.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${active.id}` }, (payload) => {
        setMessages((m) => [...m, payload.new as Message]);
        if ((payload.new as Message).sender_id !== me.id) {
          void supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', (payload.new as Message).id);
        }
        void loadConvs();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  function openConv(c: Conversation) {
    setActive(c);
    setSearchOpen(false);
  }

  async function startChat(username: string) {
    if (!me) return;
    const { data: prof } = await supabase.from('profiles').select('*').eq('username', username).single();
    if (!prof) return alert('User not found');
    if (prof.id === me.id) return alert("You can't message yourself");
    const a = me.id < prof.id ? me.id : prof.id;
    const b = me.id < prof.id ? prof.id : me.id;
    let { data: conv } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_a', a)
      .eq('user_b', b)
      .maybeSingle();
    if (!conv) {
      const { data: created } = await supabase
        .from('conversations')
        .insert({ user_a: a, user_b: b })
        .select('*')
        .single();
      conv = created;
    }
    setSearchOpen(false);
    setNewChatUser('');
    void loadConvs();
    if (conv) {
      const { data: prof2 } = await supabase.from('profiles').select('*').eq('id', prof.id).single();
      setActive({ ...(conv as Conversation), other: prof2 as Profile });
    }
  }

  async function startChatByUsername(username: string) {
    await startChat(username);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !active || !me || sending) return;
    const body = text.trim();
    setText('');
    setSendError(null);
    setSending(true);
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: active.id, sender_id: me.id, body })
      .select('*')
      .single();
    setSending(false);
    if (error) {
      setSendError(error.message);
      setBodySafe(body);
      return;
    }
    if (data) setMessages((m) => [...m, data as Message]);
    void loadConvs();
  }

  function setBodySafe(body: string) {
    setText(body);
  }

  async function startChatByProfile(p: Profile) {
    if (!me) return;
    const a = me.id < p.id ? me.id : p.id;
    const bId = me.id < p.id ? p.id : me.id;
    let { data: conv } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_a', a)
      .eq('user_b', bId)
      .maybeSingle();
    if (!conv) {
      const { data: created, error } = await supabase
        .from('conversations')
        .insert({ user_a: a, user_b: bId })
        .select('*')
        .single();
      if (error) {
        setSendError(error.message);
        return;
      }
      conv = created;
    }
    setSearchOpen(false);
    setNewChatUser('');
    void loadConvs();
    if (conv) setActive({ ...(conv as Conversation), other: p });
  }

  if (loading) return <div className="page"><Spinner /></div>;

  return (
    <div className="chat-layout">
      <div className="chat-list">
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          <div className="row between" style={{ marginBottom: 8 }}>
            <b>Chats</b>
            <Button size="sm" onClick={() => setSearchOpen((v) => !v)}>✏️ New</Button>
          </div>
          {searchOpen && (
            <>
              <form onSubmit={(e) => { e.preventDefault(); if (newChatUser.trim()) void startChat(newChatUser.trim().toLowerCase()); }} className="row" style={{ gap: 6, marginBottom: 8 }}>
                <input
                  className="input"
                  placeholder="Type username…"
                  value={newChatUser}
                  onChange={(e) => setNewChatUser(e.target.value)}
                  style={{ borderRadius: 20, padding: '8px 12px' }}
                />
                <Button type="submit" size="sm">Go</Button>
              </form>
              <div className="muted" style={{ fontSize: '0.78rem', marginBottom: 4 }}>Or pick a friend:</div>
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                {friends.length === 0 && <div className="muted" style={{ fontSize: '0.8rem', padding: 6 }}>No friends yet — add friends first or type a username above.</div>}
                {friends.map((f) => (
                  <button
                    key={f.id}
                    className="row"
                    style={{ width: '100%', padding: '6px 4px', gap: 8, borderRadius: 6, textAlign: 'left' }}
                    onClick={() => void startChatByProfile(f)}
                  >
                    <Avatar url={f.avatar_url} name={f.display_name} size={28} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{f.display_name}</span>
                    <span className="muted" style={{ fontSize: '0.75rem' }}>@{f.username}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {convs.length === 0 && !searchOpen && (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>💬</div>
            <p className="muted" style={{ marginBottom: 12 }}>No chats yet.</p>
            <Button size="sm" onClick={() => setSearchOpen(true)}>Start a chat</Button>
          </div>
        )}
        {convs.map((c) => (
          <div
            key={c.id}
            className={`chat-item ${active?.id === c.id ? 'active' : ''}`}
            onClick={() => openConv(c)}
          >
            <Avatar url={c.other?.avatar_url} name={c.other?.display_name || '?'} size={48} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row between">
                <b style={{ fontSize: '0.92rem' }}>{c.other?.display_name}</b>
                <span className="muted" style={{ fontSize: '0.72rem' }}>{c.last_message ? timeAgo(c.last_message.created_at) : ''}</span>
              </div>
              <div className="muted" style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.last_message ? (c.last_message.sender_id === me?.id ? 'You: ' : '') + (c.last_message.body || '📎 attachment') : 'Say hi!'}
              </div>
            </div>
            {(c.unread_count ?? 0) > 0 && <span className="badge" style={{ position: 'static' }}>{c.unread_count}</span>}
          </div>
        ))}
      </div>

      <div className="chat-window">
        {!active ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty message="Select a conversation or start a new one." />
          </div>
        ) : (
          <>
            <div className="row" style={{ padding: 12, borderBottom: '1px solid var(--border)', gap: 10 }}>
              <Avatar url={active.other?.avatar_url} name={active.other?.display_name || '?'} size={36} />
              <div>
                <b>{active.other?.display_name}</b>
                <div className="muted" style={{ fontSize: '0.8rem' }}>@{active.other?.username}</div>
              </div>
            </div>
            <div className="chat-messages">
              {messages.map((m) => (
                <div key={m.id} className={`bubble ${m.sender_id === me?.id ? 'bubble-me' : 'bubble-them'}`}>
                  {m.body || '📎 attachment'}
                  <div style={{ fontSize: '0.68rem', opacity: 0.75, marginTop: 2 }}>{timeAgo(m.created_at)}</div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            {sendError && (
              <div className="error-text" style={{ padding: '4px 12px' }}>{sendError}</div>
            )}
            <form onSubmit={send} className="chat-input-bar">
              <input
                className="input"
                placeholder="Aa"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={sending}
              />
              <Button type="submit" disabled={!text.trim() || sending}>{sending ? '…' : 'Send'}</Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

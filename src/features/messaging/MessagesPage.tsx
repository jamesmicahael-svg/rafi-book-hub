import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Conversation, Message, Profile } from '../../lib/types';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Feedback';
import { timeAgo } from '../../lib/utils';

type CallState = {
  active: boolean;
  type: 'audio' | 'video';
  status: 'calling' | 'ringing' | 'connected' | 'ended' | 'rejected' | 'missed';
  peerId: string | null;
};

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
  const [uploadingImg, setUploadingImg] = useState(false);
  const [call, setCall] = useState<CallState>({ active: false, type: 'audio', status: 'ended', peerId: null });
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadFriends = useCallback(async () => {
    if (!me) return;
    const { data: rels } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .or(`user_id.eq.${me.id},friend_id.eq.${me.id}`);
    const ids = (rels || []).map((r) => (r.user_id === me.id ? r.friend_id : r.user_id));
    if (!ids.length) {
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
        const msg = payload.new as Message;
        setMessages((m) => (m.find((x) => x.id === msg.id) ? m : [...m, msg]));
        if (msg.sender_id !== me.id) {
          void supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', msg.id);
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
    await startChatByProfile(prof as Profile);
  }

  async function startChatByUsername(username: string) {
    await startChat(username);
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
      setText(body);
      return;
    }
    if (data) setMessages((m) => [...m, data as Message]);
    void loadConvs();
  }

  async function sendImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !active || !me) return;
    if (file.size > 5 * 1024 * 1024) return setSendError('Image max 5 MB');
    setUploadingImg(true);
    setSendError(null);
    const path = `messages/${active.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from('media').upload(path, file, { upsert: false });
    if (upErr) {
      setUploadingImg(false);
      setSendError('Upload failed: ' + upErr.message);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    const { data: pub } = supabase.storage.from('media').getPublicUrl(path);
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: active.id, sender_id: me.id, body: '', media_url: pub.publicUrl })
      .select('*')
      .single();
    setUploadingImg(false);
    if (error) setSendError(error.message);
    else if (data) setMessages((m) => [...m, data as Message]);
    if (fileRef.current) fileRef.current.value = '';
    void loadConvs();
  }

  /* ---------- CALL (WebRTC + Supabase Realtime signaling) ---------- */
  const RTC_CONFIG: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
    ],
  };

  async function getMedia(video: boolean) {
    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video: video ? { width: 640, height: 480 } : false,
    });
  }

  function attachStreams() {
    if (localStream && localVideoRef.current) localVideoRef.current.srcObject = localStream;
    if (remoteStream && remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
  }

  useEffect(attachStreams);

  function cleanupCall() {
    localStream?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    if (callChannelRef.current) {
      void supabase.removeChannel(callChannelRef.current);
      callChannelRef.current = null;
    }
  }

  async function startCall(type: 'audio' | 'video') {
    if (!active?.other || !me) return;
    const peerId = active.other.id;
    setCall({ active: true, type, status: 'calling', peerId });

    const stream = await getMedia(type === 'video');
    setLocalStream(stream);
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.ontrack = (ev) => setRemoteStream(ev.streams[0]);
    pc.onicecandidate = (ev) => {
      if (ev.candidate && callChannelRef.current) {
        void callChannelRef.current.send({
          type: 'broadcast',
          event: 'ice',
          payload: { from: me.id, to: peerId, candidate: ev.candidate },
        });
      }
    };

    const ch = supabase.channel(`call_${me.id}_${peerId}`);
    callChannelRef.current = ch;
    ch.on('broadcast', { event: 'offer' }, async ({ payload }) => {
      if (payload.to !== me.id) return;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      void ch.send({ type: 'broadcast', event: 'answer', payload: { from: me.id, to: peerId, sdp: answer } });
      setCall((c) => ({ ...c, status: 'connected' }));
    });
    ch.on('broadcast', { event: 'answer' }, async ({ payload }) => {
      if (payload.to !== me.id) return;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      setCall((c) => ({ ...c, status: 'connected' }));
    });
    ch.on('broadcast', { event: 'ice' }, async ({ payload }) => {
      if (payload.to !== me.id) return;
      try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch { /* ignore */ }
    });
    ch.on('broadcast', { event: 'end' }, ({ payload }) => {
      if (payload.to !== me.id) return;
      setCall((c) => ({ ...c, status: 'ended', active: false }));
      cleanupCall();
    });
    ch.on('broadcast', { event: 'reject' }, ({ payload }) => {
      if (payload.to !== me.id) return;
      setCall((c) => ({ ...c, status: 'rejected', active: false }));
      cleanupCall();
    });
    ch.on('broadcast', { event: 'ring' }, ({ payload }) => {
      if (payload.to !== me.id) return;
      setCall((c) => ({ ...c, status: 'connected', active: true }));
    });
    await ch.subscribe();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    void ch.send({
      type: 'broadcast',
      event: 'offer',
      payload: { from: me.id, to: peerId, sdp: offer, callType: type },
    });
  }

  async function acceptCall() {
    if (!active?.other || !me) return;
    const peerId = active.other.id;
    const stream = await getMedia(call.type === 'video');
    setLocalStream(stream);
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.ontrack = (ev) => setRemoteStream(ev.streams[0]);
    pc.onicecandidate = (ev) => {
      if (ev.candidate && callChannelRef.current) {
        void callChannelRef.current.send({
          type: 'broadcast',
          event: 'ice',
          payload: { from: me.id, to: peerId, candidate: ev.candidate },
        });
      }
    };

    const ch = callChannelRef.current || supabase.channel(`call_${peerId}_${me.id}`);
    callChannelRef.current = ch;
    ch.on('broadcast', { event: 'answer' }, async ({ payload }) => {
      if (payload.to !== me.id) return;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      setCall((c) => ({ ...c, status: 'connected' }));
    });
    ch.on('broadcast', { event: 'ice' }, async ({ payload }) => {
      if (payload.to !== me.id) return;
      try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch { /* ignore */ }
    });
    ch.on('broadcast', { event: 'end' }, ({ payload }) => {
      if (payload.to !== me.id) return;
      setCall((c) => ({ ...c, status: 'ended', active: false }));
      cleanupCall();
    });
    await ch.subscribe();
    void ch.send({ type: 'broadcast', event: 'ring', payload: { from: me.id, to: peerId } });
    setCall((c) => ({ ...c, status: 'connected', active: true }));
  }

  function endCall() {
    if (active?.other && callChannelRef.current) {
      void callChannelRef.current.send({
        type: 'broadcast',
        event: 'end',
        payload: { from: me?.id, to: active.other.id },
      });
    }
    setCall((c) => ({ ...c, status: 'ended', active: false }));
    cleanupCall();
  }

  function rejectCall() {
    if (active?.other && callChannelRef.current) {
      void callChannelRef.current.send({
        type: 'broadcast',
        event: 'reject',
        payload: { from: me?.id, to: active.other.id },
      });
    }
    setCall((c) => ({ ...c, status: 'rejected', active: false }));
    cleanupCall();
  }

  // Listen for incoming calls on a personal channel
  useEffect(() => {
    if (!me) return;
    const ch = supabase.channel(`user_call_${me.id}`);
    ch.on('broadcast', { event: 'offer' }, async ({ payload }) => {
      if (payload.to !== me.id) return;
      // open chat with caller if possible
      const { data: caller } = await supabase.from('profiles').select('*').eq('id', payload.from).single();
      if (caller) await startChatByProfile(caller as Profile);
      setCall({
        active: true,
        type: payload.callType === 'video' ? 'video' : 'audio',
        status: 'ringing',
        peerId: payload.from,
      });
    });
    ch.subscribe();
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  if (loading) return <div className="page"><Spinner /></div>;

  const other = active?.other;

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
                {friends.length === 0 && <div className="muted" style={{ fontSize: '0.8rem', padding: 6 }}>No friends yet — type a username above.</div>}
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
            <div style={{ position: 'relative' }}>
              <Avatar url={c.other?.avatar_url} name={c.other?.display_name || '?'} size={48} />
              <span className="online-dot" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row between">
                <b style={{ fontSize: '0.92rem' }}>{c.other?.display_name}</b>
                <span className="muted" style={{ fontSize: '0.72rem' }}>{c.last_message ? timeAgo(c.last_message.created_at) : ''}</span>
              </div>
              <div className="muted" style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.last_message
                  ? (c.last_message.sender_id === me?.id ? 'You: ' : '')
                    + (c.last_message.media_url && !c.last_message.body ? '📷 Photo' : c.last_message.body || '📎')
                  : 'Say hi!'}
              </div>
            </div>
            {(c.unread_count ?? 0) > 0 && <span className="badge" style={{ position: 'static' }}>{c.unread_count}</span>}
          </div>
        ))}
      </div>

      <div className="chat-window">
        {!active ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="empty">
              <div style={{ fontSize: '3rem' }}>💬</div>
              <p>Select a chat or start a new one</p>
            </div>
          </div>
        ) : (
          <>
            <div className="chat-header">
              <div className="row" style={{ gap: 10 }}>
                <div style={{ position: 'relative' }}>
                  <Avatar url={other?.avatar_url} name={other?.display_name || '?'} size={40} />
                  <span className="online-dot" />
                </div>
                <div>
                  <b>{other?.display_name}</b>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>@{other?.username}</div>
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="icon-btn" title="Voice call" onClick={() => void startCall('audio')} disabled={call.active} aria-label="Voice call">📞</button>
                <button className="icon-btn" title="Video call" onClick={() => void startCall('video')} disabled={call.active} aria-label="Video call">🎥</button>
              </div>
            </div>

            <div className="chat-messages">
              {messages.map((m) => (
                <div key={m.id} className={`msg-row ${m.sender_id === me?.id ? 'me' : 'them'}`}>
                  {m.sender_id !== me?.id && <Avatar url={other?.avatar_url} name={other?.display_name || '?'} size={28} />}
                  <div className={`bubble ${m.sender_id === me?.id ? 'bubble-me' : 'bubble-them'}`}>
                    {m.media_url && (
                      <img
                        src={m.media_url}
                        alt=""
                        className="msg-image"
                        onClick={() => window.open(m.media_url!, '_blank')}
                      />
                    )}
                    {m.body && <div className="bubble-text">{m.body}</div>}
                    <div className="bubble-time">{timeAgo(m.created_at)}</div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {sendError && <div className="error-text" style={{ padding: '4px 12px' }}>{sendError}</div>}

            <form onSubmit={send} className="chat-input-bar">
              <button
                type="button"
                className="icon-btn"
                title="Send photo"
                onClick={() => fileRef.current?.click()}
                disabled={uploadingImg}
                aria-label="Attach image"
              >
                {uploadingImg ? '⏳' : '📷'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void sendImage(e)} />
              <input
                className="input"
                placeholder="Aa"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={sending || uploadingImg}
              />
              <Button type="submit" disabled={!text.trim() || sending}>{sending ? '…' : 'Send'}</Button>
            </form>
          </>
        )}
      </div>

      {/* CALL OVERLAY */}
      {call.active && (
        <div className="call-overlay">
          <div className="call-box">
            {call.status === 'ringing' ? (
              <>
                <Avatar url={other?.avatar_url} name={other?.display_name || '?'} size={80} />
                <h3>{other?.display_name}</h3>
                <p className="muted">Incoming {call.type} call…</p>
                <div className="row" style={{ gap: 16, marginTop: 16 }}>
                  <button className="call-btn accept" onClick={() => void acceptCall()} aria-label="Accept">✅</button>
                  <button className="call-btn reject" onClick={rejectCall} aria-label="Reject">❌</button>
                </div>
              </>
            ) : call.status === 'calling' ? (
              <>
                <Avatar url={other?.avatar_url} name={other?.display_name || '?'} size={80} />
                <h3>{other?.display_name}</h3>
                <p className="muted">Calling…</p>
                <button className="call-btn reject" style={{ marginTop: 16 }} onClick={endCall} aria-label="Cancel">📞</button>
              </>
            ) : (
              <>
                <div className="call-videos">
                  {call.type === 'video' ? (
                    <>
                      <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
                      <video ref={localVideoRef} autoPlay playsInline muted className="local-video" />
                    </>
                  ) : (
                    <div className="audio-call">
                      <Avatar url={other?.avatar_url} name={other?.display_name || '?'} size={100} />
                      <h3 style={{ marginTop: 12 }}>{other?.display_name}</h3>
                      <audio ref={(el) => { if (el && remoteStream) el.srcObject = remoteStream; }} autoPlay />
                      <audio ref={(el) => { if (el && localStream) el.srcObject = localStream; }} autoPlay muted />
                    </div>
                  )}
                </div>
                <div className="row" style={{ gap: 16, marginTop: 12 }}>
                  <button className="call-btn reject" onClick={endCall} aria-label="End call">📞</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

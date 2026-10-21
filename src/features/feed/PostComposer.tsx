import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Form';

const VISIBILITY_OPTIONS = [
  { value: 'public', label: '🌍 Public' },
  { value: 'friends', label: '👥 Friends' },
  { value: 'private', label: '🔒 Only me' },
];

export function PostComposer({ onPosted }: { onPosted: () => void }) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // simple file-to-base64 storage (Supabase Storage optional)
  async function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError('Image must be under 5 MB');
    // upload to Supabase storage if configured
    const path = `posts/${profile!.id}/${Date.now()}-${file.name}`;
    const { error: upErr, data } = await supabase.storage.from('media').upload(path, file, { upsert: false });
    if (upErr) {
      // fallback: store as data URL for small images (dev only)
      if (file.size < 400 * 1024) {
        const reader = new FileReader();
        reader.onload = () => {
          sessionStorage.setItem(`img_${path}`, String(reader.result));
          setBody((b) => b); // keep; attach via hidden state below
        };
        reader.readAsDataURL(file);
      }
      setError('Upload failed — check storage bucket "media". Post text still works.');
      return;
    }
    const { data: pub } = supabase.storage.from('media').getPublicUrl(path);
    setError(null);
    // stash URL
    setPendingMedia({ url: pub.publicUrl, type: 'image' as const });
  }

  const [pendingMedia, setPendingMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

  async function submit() {
    if (!profile || (!body.trim() && !pendingMedia)) return;
    setPosting(true);
    setError(null);
    const { error: err } = await supabase.from('posts').insert({
      author_id: profile.id,
      body: body.trim(),
      visibility,
      media_url: pendingMedia?.url ?? null,
      media_type: pendingMedia?.type ?? null,
    });
    setPosting(false);
    if (err) return setError(err.message);
    setBody('');
    setPendingMedia(null);
    setOpen(false);
    onPosted();
  }

  return (
    <>
      <div className="card card-pad">
        <div className="row">
          <Avatar url={profile?.avatar_url} name={profile?.display_name || '?'} size={40} />
          <button
            onClick={() => setOpen(true)}
            className="input"
            style={{ flex: 1, textAlign: 'left', borderRadius: 24, color: 'var(--text-2)', cursor: 'text', padding: '12px 16px' }}
          >
            What's on your mind, {profile?.display_name?.split(' ')[0] || 'friend'}?
          </button>
        </div>
      </div>

      <Modal
        open={open}
        title="Create post"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={posting || (!body.trim() && !pendingMedia)}>
              {posting ? 'Posting…' : 'Post'}
            </Button>
          </>
        }
      >
        <div className="row" style={{ marginBottom: 12 }}>
          <Avatar url={profile?.avatar_url} name={profile?.display_name || '?'} size={40} />
          <div>
            <b>{profile?.display_name}</b>
            <div className="muted">@{profile?.username}</div>
          </div>
        </div>
        <Select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
          aria-label="Post visibility"
          style={{ marginBottom: 10 }}
        >
          {VISIBILITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <textarea
          className="textarea"
          style={{ minHeight: 120, border: 'none', fontSize: '1.1rem', background: 'transparent' }}
          placeholder={`What's on your mind, ${profile?.display_name?.split(' ')[0] || 'friend'}?`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          autoFocus
        />
        {pendingMedia && (
          <div className="row between" style={{ background: 'var(--surface-2)', padding: 8, borderRadius: 6 }}>
            <span className="muted">🖼️ Image attached</span>
            <button className="btn btn-sm btn-danger" onClick={() => setPendingMedia(null)}>Remove</button>
          </div>
        )}
        {error && <div className="error-text" style={{ marginTop: 8 }}>{error}</div>}
        <div className="row wrap" style={{ marginTop: 12, gap: 8 }}>
          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
            📷 Photo/Video
            <input type="file" accept="image/*,video/*" hidden onChange={pickImage} />
          </label>
        </div>
      </Modal>
    </>
  );
}

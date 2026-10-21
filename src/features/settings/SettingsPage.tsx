import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Input, Textarea } from '../../components/ui/Form';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Feedback';
import type { Profile } from '../../lib/types';

export function SettingsPage() {
  const { profile: me, refreshProfile } = useAuth();
  const [form, setForm] = useState<Partial<Profile>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (me) setForm({ ...me });
  }, [me]);

  async function save() {
    if (!me) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const { error: err } = await supabase.from('profiles').update({
      display_name: form.display_name,
      bio: form.bio,
      location: form.location,
      website: form.website,
      education: form.education,
      work: form.work,
      is_private: form.is_private,
    }).eq('id', me.id);
    setSaving(false);
    if (err) return setError(err.message);
    await refreshProfile();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !me) return;
    const path = `avatars/${me.id}/${Date.now()}-${file.name}`;
    const { error: err } = await supabase.storage.from('media').upload(path, file, { upsert: true });
    if (err) return setError('Avatar upload failed: ' + err.message);
    const { data } = supabase.storage.from('media').getPublicUrl(path);
    await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', me.id);
    await refreshProfile();
  }

  if (!me) return <div className="page"><Spinner /></div>;

  return (
    <div className="page" style={{ maxWidth: 560 }}>
      <div className="card card-pad">
        <div className="card-title">Edit profile</div>
        <div className="row" style={{ marginBottom: 16 }}>
          <img
            src={form.avatar_url || undefined}
            alt=""
            style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--primary)', objectFit: 'cover' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
            Change photo
            <input type="file" accept="image/*" hidden onChange={uploadAvatar} />
          </label>
        </div>
        <Input label="Display name" value={form.display_name || ''} onChange={(e) => setForm({ ...form, display_name: e.target.value })} required />
        <Textarea label="Bio" value={form.bio || ''} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Tell people about yourself…" />
        <Input label="Work" value={form.work || ''} onChange={(e) => setForm({ ...form, work: e.target.value })} placeholder="e.g. Software Engineer at Acme" />
        <Input label="Education" value={form.education || ''} onChange={(e) => setForm({ ...form, education: e.target.value })} placeholder="e.g. BSc CS, Dhaka University" />
        <Input label="Location" value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Dhaka, Bangladesh" />
        <Input label="Website" value={form.website || ''} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" />
        <div className="field">
          <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!form.is_private}
              onChange={(e) => setForm({ ...form, is_private: e.target.checked })}
            />
            <span style={{ fontWeight: 600 }}>Private account</span>
          </label>
          <div className="muted" style={{ marginTop: 4 }}>Only approved friends can see your posts.</div>
        </div>
        {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}
        {saved && <div className="success-text" style={{ marginBottom: 10 }}>Profile saved ✓</div>}
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
      </div>

      <div className="card card-pad">
        <div className="card-title">Account</div>
        <p className="muted">Signed in as <b>{me.username}</b></p>
        <p className="muted">Email notifications and password changes are managed via Supabase Auth.</p>
      </div>
    </div>
  );
}

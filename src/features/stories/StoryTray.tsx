import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Story } from '../../lib/types';
import { Avatar } from '../../components/ui/Avatar';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { timeAgo } from '../../lib/utils';

export function StoryTray({ onChanged }: { onChanged?: () => void }) {
  const { profile } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<{ user: string; items: Story[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
    if (!profile) return;
    const ch = supabase
      .channel('stories')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stories' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function load() {
    if (!profile) return;
    const { data: friends } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`);
    const ids = (friends || []).flatMap((f) => [f.user_id, f.friend_id]).filter((id) => id !== profile.id);
    ids.push(profile.id);
    const { data } = await supabase
      .from('stories')
      .select('*, user:profiles(*)')
      .in('user_id', ids)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true });
    setStories((data as Story[]) || []);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploading(true);
    const path = `stories/${profile.id}/${Date.now()}-${file.name}`;
    const { data: up, error } = await supabase.storage.from('media').upload(path, file, { upsert: false });
    if (error) {
      alert('Upload failed: ' + error.message);
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from('media').getPublicUrl(up.path);
    await supabase.from('stories').insert({
      user_id: profile.id,
      media_url: pub.publicUrl,
      media_type: file.type.startsWith('video') ? 'video' : 'image',
    });
    setUploading(false);
    load();
    onChanged?.();
    if (fileRef.current) fileRef.current.value = '';
  }

  // group by user
  const byUser = new Map<string, Story[]>();
  for (const s of stories) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
    byUser.get(s.user_id)!.push(s);
  }
  const grouped = [...byUser.entries()];

  return (
    <>
      <div className="stories-row">
        <div style={{ flexShrink: 0, width: 110, textAlign: 'center' }}>
          <button
            onClick={() => fileRef.current?.click()}
            style={{ width: 110, height: 180, borderRadius: 12, position: 'relative', overflow: 'hidden', background: 'var(--surface-2)', border: '2px dashed var(--border)', cursor: 'pointer' }}
            disabled={uploading}
          >
            <div style={{ paddingTop: 40 }}>
              <Avatar url={profile?.avatar_url} name={profile?.display_name || '?'} size={48} />
              <div style={{ marginTop: 8, fontWeight: 700, fontSize: '0.8rem' }}>{uploading ? 'Uploading…' : '+ Create'}</div>
            </div>
          </button>
          <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={onFile} />
        </div>
        {grouped.map(([uid, items]) => (
          <button
            key={uid}
            className="story-item"
            onClick={() => setViewing({ user: items[0].user?.display_name || 'User', items })}
          >
            {items[0].media_type === 'image' ? (
              <img src={items[0].media_url} alt="" />
            ) : (
              <video src={items[0].media_url} muted />
            )}
            <div style={{ position: 'absolute', bottom: 10, left: 8, color: '#fff', fontWeight: 700, fontSize: '0.8rem', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
              {items[0].user?.display_name}
            </div>
          </button>
        ))}
      </div>

      <Modal open={!!viewing} title={viewing?.user || ''} onClose={() => setViewing(null)}>
        {viewing && (
          <div>
            {viewing.items.map((s) => (
              <div key={s.id} style={{ marginBottom: 12 }}>
                {s.media_type === 'image' ? (
                  <img src={s.media_url} alt="" style={{ width: '100%', borderRadius: 8 }} />
                ) : (
                  <video src={s.media_url} controls style={{ width: '100%', borderRadius: 8 }} />
                )}
                <div className="muted" style={{ marginTop: 4 }}>{timeAgo(s.created_at)}</div>
              </div>
            ))}
            <Button variant="secondary" block onClick={() => setViewing(null)}>Close</Button>
          </div>
        )}
      </Modal>
    </>
  );
}

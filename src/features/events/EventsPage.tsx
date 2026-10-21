import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { EventItem } from '../../lib/types';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Textarea } from '../../components/ui/Form';
import { Spinner, Empty } from '../../components/ui/Feedback';
import { timeAgo } from '../../lib/utils';

export function EventsPage() {
  const { profile: me } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', description: '', location: '', starts_at: '' });

  const load = useCallback(async () => {
    if (!me) return;
    setLoading(true);
    const { data } = await supabase.from('events').select('*').order('starts_at', { ascending: true });
    const rows = (data as EventItem[]) || [];
    const withCounts = await Promise.all(rows.map(async (e) => {
      const { count } = await supabase.from('event_attendees').select('*', { count: 'exact', head: true }).eq('event_id', e.id).eq('status', 'going');
      return { ...e, attendee_count: count ?? 0 };
    }));
    setEvents(withCounts);
    setLoading(false);
  }, [me]);

  useEffect(() => { void load(); }, [load]);

  async function createEvent() {
    if (!me || !form.title.trim() || !form.starts_at) return;
    const { error } = await supabase.from('events').insert({
      creator_id: me.id,
      title: form.title.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      starts_at: new Date(form.starts_at).toISOString(),
    });
    if (error) return alert(error.message);
    setForm({ title: '', description: '', location: '', starts_at: '' });
    setOpen(false);
    load();
  }

  async function attend(id: string, status: 'going' | 'maybe' | 'declined') {
    if (!me) return;
    await supabase.from('event_attendees').upsert({ event_id: id, user_id: me.id, status });
    load();
  }

  if (loading) return <div className="page"><Spinner /></div>;

  return (
    <div className="page">
      <div className="card card-pad">
        <div className="row between">
          <div className="card-title" style={{ marginBottom: 0 }}>Events</div>
          <Button onClick={() => setOpen(true)}>➕ Create event</Button>
        </div>
      </div>

      {events.length === 0 ? <Empty message="No upcoming events." /> : events.map((e) => (
        <div key={e.id} className="card card-pad">
          <div className="row between">
            <div>
              <b style={{ fontSize: '1.05rem' }}>{e.title}</b>
              <div className="muted">
                {new Date(e.starts_at).toLocaleString()} {e.location && `· 📍 ${e.location}`}
              </div>
            </div>
            <span className="chip">{e.attendee_count} going</span>
          </div>
          {e.description && <p style={{ margin: '10px 0' }}>{e.description}</p>}
          <div className="row" style={{ gap: 8 }}>
            <Button size="sm" onClick={() => attend(e.id, 'going')}>✅ Going</Button>
            <Button size="sm" variant="secondary" onClick={() => attend(e.id, 'maybe')}>🤔 Maybe</Button>
            <Button size="sm" variant="secondary" onClick={() => attend(e.id, 'declined')}>❌ Can't go</Button>
            <span className="muted" style={{ marginLeft: 'auto' }}>Created {timeAgo(e.created_at)}</span>
          </div>
        </div>
      ))}

      <Modal
        open={open}
        title="Create event"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={createEvent} disabled={!form.title.trim() || !form.starts_at}>Create</Button>
          </>
        }
      >
        <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Venue or online link" />
        <Input label="Starts at" type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} required />
      </Modal>
    </div>
  );
}

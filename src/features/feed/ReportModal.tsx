import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Select, Textarea } from '../../components/ui/Form';
import { useAuth } from '../../contexts/AuthContext';

const REASONS = [
  'Spam',
  'Harassment or bullying',
  'Hate speech',
  'Violence or dangerous content',
  'Nudity or sexual content',
  'Misinformation',
  'Other',
];

export function ReportModal({
  open,
  onClose,
  targetType,
  targetId,
}: {
  open: boolean;
  onClose: () => void;
  targetType: 'post' | 'comment' | 'profile';
  targetId: string;
}) {
  const { profile } = useAuth();
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [done, setDone] = useState(false);

  async function submit() {
    if (!profile) return;
    await supabase.from('reports').insert({
      reporter_id: profile.id,
      target_type: targetType,
      target_id: targetId,
      reason: details.trim() ? `${reason}: ${details.trim()}` : reason,
    });
    setDone(true);
  }

  function close() {
    setDone(false);
    setDetails('');
    onClose();
  }

  return (
    <Modal open={open} title={`Report ${targetType}`} onClose={close}>
      {done ? (
        <div className="center" style={{ padding: 16 }}>
          <div style={{ fontSize: '2.5rem' }}>✅</div>
          <h3 style={{ margin: '8px 0' }}>Report submitted</h3>
          <p className="muted">Our team will review it shortly.</p>
          <Button onClick={close} style={{ marginTop: 12 }}>Done</Button>
        </div>
      ) : (
        <>
          <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => <option key={r}>{r}</option>)}
          </Select>
          <Textarea
            label="Additional details (optional)"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Tell us more…"
          />
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button variant="danger" onClick={submit}>Submit report</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

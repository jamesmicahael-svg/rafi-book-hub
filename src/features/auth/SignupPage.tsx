import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Input } from '../../components/ui/Form';
import { Button } from '../../components/ui/Button';
import { validateUsername, validatePassword } from '../../lib/utils';

export function SignupPage() {
  const nav = useNavigate();
  const [form, setForm] = useState({ displayName: '', username: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const uErr = validateUsername(form.username.toLowerCase());
    if (uErr) return setError(uErr);
    const pErr = validatePassword(form.password);
    if (pErr) return setError(pErr);
    if (form.password !== form.confirm) return setError('Passwords do not match');
    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { username: form.username.toLowerCase(), display_name: form.displayName || form.username } },
    });
    setLoading(false);
    if (err) return setError(err.message);
    // update profile username via trigger already handles insert; ensure display name
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        username: form.username.toLowerCase(),
        display_name: form.displayName || form.username,
      });
    }
    if (data.session) nav('/');
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="auth-page">
        <div className="auth-card center">
          <div style={{ fontSize: '3rem' }}>📧</div>
          <h2 style={{ margin: '12px 0' }}>Confirm your email</h2>
          <p className="muted">We sent a confirmation link to <b>{form.email}</b>. Click it, then log in.</p>
          <Link to="/login"><Button style={{ marginTop: 16 }} block>Go to login</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">Rafi Book</div>
        <p className="auth-sub">It's quick and easy.</p>
        <form onSubmit={onSubmit}>
          <Input label="Display name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Rafi Ahmed" required />
          <Input label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} placeholder="rafi_ahmed" required minLength={3} maxLength={24} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" />
          <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="new-password" />
          <Input label="Confirm password" type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required autoComplete="new-password" />
          {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}
          <Button type="submit" block size="lg" disabled={loading}>{loading ? 'Creating…' : 'Sign up'}</Button>
        </form>
        <p className="center muted" style={{ marginTop: 16 }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Log in</Link>
        </p>
      </div>
    </div>
  );
}

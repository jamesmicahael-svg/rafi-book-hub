import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Input } from '../../components/ui/Form';
import { Button } from '../../components/ui/Button';
import { validateUsername, validatePassword } from '../../lib/utils';

export function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) setError(err.message);
    else nav('/');
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">Rafi Book</div>
        <p className="auth-sub">Connect with friends and the world around you.</p>
        <form onSubmit={onSubmit}>
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}
          <Button type="submit" block size="lg" disabled={loading}>{loading ? 'Logging in…' : 'Log in'}</Button>
        </form>
        <p className="center muted" style={{ marginTop: 16 }}>
          New here? <Link to="/signup" style={{ color: 'var(--primary)', fontWeight: 600 }}>Create an account</Link>
        </p>
      </div>
    </div>
  );
}

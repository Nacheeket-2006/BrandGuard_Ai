import { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { api } from './api';
import type { Identity } from './types';

export function AuthPage({
  onAuthenticated,
  onDemo,
  demoAvailable,
  registrationEnabled,
  browserOnly,
}: {
  onAuthenticated: (user: Identity) => Promise<void>;
  onDemo: () => Promise<void>;
  demoAvailable: boolean;
  registrationEnabled: boolean;
  browserOnly: boolean;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const registering = mode === 'register';
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (registering && password !== confirm) {
      setError('Your passwords do not match. Please try again.');
      return;
    }
    setBusy(true);
    try {
      const user = registering
        ? await api.register(name.trim(), email.trim(), password)
        : await api.login(email.trim(), password);
      setPassword('');
      setConfirm('');
      await onAuthenticated(user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <header className="auth-header">
        <div className="logo">
          <span className="logo-icon">
            <ShieldCheck size={24} />
          </span>
          BrandGuard <b>AI</b>
        </div>
        <ThemeToggle />
      </header>
      <main className="auth-layout">
        <section className="auth-story">
          <div className="eyebrow">
            <span className="tiny-square" /> YOUR BRAND, WITH INTENTION
          </div>
          <h1>
            Good ideas.
            <br />
            <em>Great alignment.</em>
          </h1>
          <p>
            A thoughtful second pair of eyes for every draft. Keep your voice, protect your brand,
            and let your next idea shine.
          </p>
          <div className="auth-bento">
            <div>
              <BookOpen size={24} />
              <strong>One source of truth.</strong>
              <p>Your guidelines, right where you need them.</p>
            </div>
            <div>
              <Sparkles size={24} />
              <strong>Clarity before you publish.</strong>
              <p>Cited feedback. Helpful rewrites. Your decision.</p>
            </div>
            <div className="auth-human">
              <ShieldCheck size={24} />
              <strong>The final word is human.</strong>
              <span>
                <Check size={16} /> Creator control <Check size={16} /> Manager sign-off
              </span>
            </div>
          </div>
          <span className="auth-footnote">A little guidance. A lot more confidence.</span>
        </section>
        <section className="auth-form-card" aria-labelledby="auth-title">
          <div className="auth-tabs" role="group" aria-label="Account access">
            <button
              aria-pressed={!registering}
              onClick={() => {
                setMode('login');
                setError('');
                setPassword('');
                setConfirm('');
              }}
            >
              Sign in
            </button>
            <button
              aria-pressed={registering}
              onClick={() => {
                setMode('register');
                setError('');
                setPassword('');
                setConfirm('');
              }}
            >
              Create account
            </button>
          </div>
          <span className="eyebrow">
            {registering ? 'A FRESH START' : 'YOUR REVIEW DESK AWAITS'}
          </span>
          <h2 id="auth-title">{registering ? 'Make yourself at home.' : 'Welcome back.'}</h2>
          <p>
            {registering
              ? 'Create your creator account and start with a clearer draft.'
              : 'Sign in to pick up where your ideas left off.'}
          </p>
          {registering && !registrationEnabled ? (
            <div className="auth-notice" role="status">
              {browserOnly
                ? 'Account creation needs the local FastAPI backend. You can still explore the demo below.'
                : 'Registration is currently closed. Contact your workspace administrator for access.'}
            </div>
          ) : (
            <form onSubmit={submit}>
              {registering && (
                <label htmlFor="auth-name">
                  Full name
                  <input
                    id="auth-name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    minLength={2}
                    maxLength={80}
                    placeholder="Your name"
                    required
                    disabled={busy}
                  />
                </label>
              )}
              <label htmlFor="auth-email">
                Email address
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={254}
                  placeholder="you@company.com"
                  required
                  disabled={busy}
                />
              </label>
              <label htmlFor="auth-password">
                Password
                <div className="password-field">
                  <input
                    id="auth-password"
                    type={visible ? 'text' : 'password'}
                    autoComplete={registering ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={registering ? 12 : 1}
                    maxLength={128}
                    placeholder={registering ? 'At least 12 characters' : 'Enter your password'}
                    required
                    disabled={busy}
                  />
                  <button
                    type="button"
                    onClick={() => setVisible(!visible)}
                    aria-label={visible ? 'Hide password' : 'Show password'}
                  >
                    {visible ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
                {registering && (
                  <small>Use at least 12 characters. Spaces and passphrases are welcome.</small>
                )}
              </label>
              {registering && (
                <label htmlFor="auth-confirm">
                  Confirm password
                  <input
                    id="auth-confirm"
                    type={visible ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    maxLength={128}
                    placeholder="Enter your password again"
                    required
                    disabled={busy}
                  />
                </label>
              )}
              {error && (
                <div className="auth-error" role="alert">
                  {error}
                </div>
              )}
              <button className="primary auth-submit" disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={18} /> : null}
                {busy ? 'Opening your workspace…' : registering ? 'Create account' : 'Sign in'}
                {!busy && <ArrowRight size={18} />}
              </button>
            </form>
          )}
          {error && registering && !registrationEnabled && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          {demoAvailable && (
            <>
              <div className="auth-divider">
                <span>or take a look around</span>
              </div>
              <button
                className="secondary demo-entry"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  try {
                    await onDemo();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Explore the demo <ArrowRight size={17} />
              </button>
              <p className="auth-demo-note">No account needed. Demo personas use sample data.</p>
            </>
          )}
          <div className="auth-tour-note">
            <BookOpen size={17} />
            <p>
              New here? An optional guided tour is available inside your workspace. Start it
              whenever you like.
            </p>
          </div>
        </section>
      </main>
      <footer className="auth-footer">
        BrandGuard AI <span>Thoughtful content. Consistent brands.</span>
      </footer>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ShieldCheck,
  LayoutDashboard,
  BookOpen,
  History,
  CheckCheck,
  ArrowUpRight,
  Plus,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Check,
  X,
  Upload,
  FileText,
  MoreHorizontal,
  Search,
  Settings,
  PanelLeftClose,
  Info,
  Clock,
  AlertTriangle,
  Image as ImageIcon,
  Download,
  LogOut,
  LoaderCircle,
  MessageSquare,
  RotateCcw,
  ExternalLink,
  Link2,
  Command,
  Send,
  Eye,
  PenLine,
} from 'lucide-react';
import { diffWords } from 'diff';
import { api, setRole as setApiRole } from './api';
import sample from './shared/sample.json';
import type { Action, Draft, Guideline, Issue, Review, Role, Visual, Identity } from './types';
import './style.css';
import { ThemeToggle } from './ThemeToggle';
import { AuthPage } from './AuthPage';
import { Walkthrough } from './Walkthrough';

const emptyVisual: Visual = { colors: [], logoPosition: '', image: '' };
const sampleDraft: Draft = { ...sample, visual: emptyVisual };
const ago = (n: number) =>
  new Date(n * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
function Ring({ score, size = 90 }: { score: number; size?: number }) {
  return (
    <div className="alignment-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="43" className="ring-track" />
        <circle
          cx="50"
          cy="50"
          r="43"
          className="ring-fill"
          strokeDasharray={`${score * 2.702} 270.2`}
          style={{ stroke: score >= 85 ? '#53ddbc' : score >= 60 ? '#b59bff' : '#f6bd73' }}
        />
      </svg>
      <div>
        <strong>
          {score}
          <small>%</small>
        </strong>
      </div>
    </div>
  );
}
function Badge({ children, kind = 'neutral' }: { children: React.ReactNode; kind?: string }) {
  return <span className={`badge ${kind}`}>{children}</span>;
}
function App() {
  const [page, setPage] = useState('workspace'),
    [role, setRole] = useState<Role>('creator'),
    [health, setHealth] = useState<{
      demo: boolean;
      registrationEnabled: boolean;
      aiMode: string;
      browser: boolean;
      vectorStore: string;
    } | null>(null),
    [logged, setLogged] = useState(false),
    [loading, setLoading] = useState(true);
  const [gs, setGs] = useState<Guideline[]>([]),
    [reviews, setReviews] = useState<Review[]>([]),
    [draft, setDraft] = useState<Draft>(sampleDraft),
    [review, setReview] = useState<Review | null>(null),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(''),
    [tab, setTab] = useState('All findings'),
    [view, setView] = useState('review'),
    [selected, setSelected] = useState(''),
    [showAsset, setShowAsset] = useState(false),
    [comment, setComment] = useState(''),
    [search, setSearch] = useState(''),
    [identity, setIdentity] = useState<Identity | null>(null),
    [demoSession, setDemoSession] = useState(false),
    [tourOpen, setTourOpen] = useState(false),
    [collapsed, setCollapsed] = useState(false);
  const uploader = useRef<HTMLInputElement>(null),
    assetUpload = useRef<HTMLInputElement>(null),
    editor = useRef<HTMLTextAreaElement>(null),
    runLock = useRef(false);
  const tourReturnPage = useRef('workspace');
  const notify = (s: string) => setToast(s);
  const refresh = async () => {
    const [g, r] = await Promise.all([api.guidelines(), api.reviews()]);
    setGs(g);
    setReviews(r);
  };
  useEffect(() => {
    void (async () => {
      try {
        const h = await api.init();
        setHealth(h);
        try {
          const u = await api.me();
          if (!u.demo && !u.id.startsWith('demo-')) {
            setRole(u.role);
            setApiRole(u.role);
            setIdentity(u);
            await refresh();
            setLogged(true);
          }
        } catch {
          /* Show the account screen for signed-out visitors. */
        }
      } catch (e) {
        notify((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [logged]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 5500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (logged && !tourOpen && role === 'creator') void run();
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [draft, logged, role, tourOpen]);
  const openCount = review?.issues.filter((i) => i.status === 'open').length || 0;
  const rejected = review?.issues.filter((i) => i.status === 'rejected').length || 0;
  const isStale =
    !!review &&
    (draft.text !== review.text ||
      JSON.stringify(draft.visual) !== JSON.stringify(review.visual) ||
      draft.title !== review.title ||
      draft.channel !== review.channel);
  const editable =
    role === 'creator' && (!review || ['draft', 'returned'].includes(review.status) || isStale);
  const changeRole = async (r: Role) => {
    setRole(r);
    setApiRole(r);
    setReview(null);
    setDraft(sampleDraft);
    setComment('');
    setPage(r === 'manager' ? 'approvals' : r === 'admin' ? 'guidelines' : 'workspace');
    try {
      await refresh();
    } catch (e) {
      notify((e as Error).message);
    }
  };
  async function run() {
    if (runLock.current) return;
    if (!draft.text.trim()) {
      notify('Write a draft before running an audit.');
      return;
    }
    runLock.current = true;
    setBusy(true);
    try {
      const r = await api.review(draft);
      setReview(r);
      setView('review');
      setTab('All findings');
      setSelected('');
      await refresh();
      notify(`Audit complete · ${r.issues.length} findings`);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
      runLock.current = false;
    }
  }
  async function action(a: Action, i = '') {
    if (!review || busy) return;
    setBusy(true);
    try {
      const r = await api.action(review, a, i, comment);
      setReview(r);
      setDraft({ title: r.title, channel: r.channel, text: r.text, visual: r.visual });
      await refresh();
      notify(
        a === 'accept'
          ? 'Suggested rewrite accepted. Original preserved in history.'
          : a === 'reject'
            ? 'Suggestion rejected. The risk remains visible for the manager.'
            : a === 'submit'
              ? 'Sent to the manager approval queue.'
              : a === 'approve'
                ? 'Signed off for publication.'
                : a === 'return'
                  ? 'Draft returned with your feedback.'
                  : 'Finding reopened.',
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const openReview = (r: Review, manager = false) => {
    setReview(r);
    setDraft({ title: r.title, channel: r.channel, text: r.text, visual: r.visual });
    setComment('');
    setPage(manager ? 'manager' : 'workspace');
    setView('review');
    setSelected('');
  };
  const newDraft = () => {
    setDraft({
      title: 'Untitled campaign',
      channel: 'LinkedIn post',
      text: '',
      visual: emptyVisual,
    });
    setReview(null);
    setPage('workspace');
    setView('edit');
    setComment('');
    setTimeout(() => editor.current?.focus(), 0);
  };
  const download = (r: Review) => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `brandguard-${r.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Audit report exported.');
  };
  async function uploadGuideline(file: File) {
    setBusy(true);
    try {
      await api.upload(file);
      await refresh();
      notify('Guideline ingested and added to active sources.');
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
      if (uploader.current) uploader.current.value = '';
    }
  }
  async function attach(file: File) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 3000000) {
      notify('Use a PNG, JPEG, or WebP image under 3 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((d) => ({ ...d, visual: { ...d.visual, image: String(reader.result) } }));
      setShowAsset(true);
      notify('Asset attached. Run an audit to review this revision.');
    };
    reader.readAsDataURL(file);
  }
  function highlighted() {
    if (!review || isStale) return draft.text;
    const active = review.issues
      .filter((i) => i.status !== 'accepted' && i.target === 'text')
      .sort((a, b) => a.startIndex - b.startIndex);
    let cursor = 0;
    const spans: React.ReactNode[] = [];
    for (const i of active) {
      if (i.startIndex < cursor) continue;
      spans.push(draft.text.slice(cursor, i.startIndex));
      spans.push(
        <button
          key={i.id}
          onClick={() => {
            setSelected(i.id);
            setTab('All findings');
            document
              .getElementById('finding-' + i.id)
              ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }}
          className={`mark ${i.severity} ${selected === i.id ? 'selected' : ''}`}
          title={i.explanation}
        >
          {draft.text.slice(i.startIndex, i.endIndex)}
        </button>,
      );
      cursor = i.endIndex;
    }
    spans.push(draft.text.slice(cursor));
    return spans;
  }
  const pending = reviews.filter((r) => r.status === 'pending');
  const pageTitle =
    page === 'guidelines'
      ? 'Brand guidelines'
      : page === 'approvals'
        ? 'Approval queue'
        : page === 'history'
          ? 'Review history'
          : page === 'settings'
            ? 'Workspace settings'
            : page === 'manager'
              ? 'Manager review'
              : page === 'handoff'
                ? 'Approval handoff'
                : 'Review workspace';
  const activeGs = gs.filter((g) => g.active);
  const avatarText = demoSession
    ? role === 'creator'
      ? 'NS'
      : role === 'manager'
        ? 'AM'
        : 'AD'
    : (identity?.name || identity?.id || 'Member')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();
  if (loading)
    return (
      <div className="boot">
        <ShieldCheck size={42} />
        <p>Opening your brand workspace…</p>
        <LoaderCircle className="spin" />
      </div>
    );
  if (!logged)
    return (
      <AuthPage
        demoAvailable={!!health?.demo}
        registrationEnabled={!!health?.registrationEnabled}
        browserOnly={!!health?.browser}
        onAuthenticated={async (u) => {
          setApiRole(u.role);
          setRole(u.role);
          setIdentity(u);
          setDemoSession(false);
          await refresh();
          setPage(
            u.role === 'manager' ? 'approvals' : u.role === 'admin' ? 'guidelines' : 'workspace',
          );
          setReview(null);
          setDraft(sampleDraft);
          setLogged(true);
        }}
        onDemo={async () => {
          await api.logout();
          setApiRole('creator');
          setRole('creator');
          setIdentity(null);
          setDemoSession(true);
          await refresh();
          setPage('workspace');
          setReview(null);
          setDraft(sampleDraft);
          setLogged(true);
        }}
      />
    );
  return (
    <div className={`app ${collapsed ? 'collapsed' : ''}`}>
      <aside className="sidebar">
        <button className="logo" onClick={() => setPage('workspace')} aria-label="BrandGuard home">
          <span className="logo-icon">
            <ShieldCheck size={23} />
          </span>
          <span className="hide-small">
            BrandGuard <b>AI</b>
          </span>
        </button>
        <div className="workspace-select">
          <span className="workspace-avatar">B</span>
          <span className="hide-small">
            <strong>BrandGuard Studio</strong>
            <small>Brand workspace</small>
          </span>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label hide-small">WORKSPACE</div>
        <nav>
          {[
            { id: 'workspace', icon: LayoutDashboard, label: 'Review workspace' },
            { id: 'guidelines', icon: BookOpen, label: 'Brand guidelines' },
            { id: 'approvals', icon: CheckCheck, label: 'Approvals' },
            { id: 'history', icon: History, label: 'Review history' },
          ].map((n) => (
            <button
              className={
                page === n.id || (n.id === 'approvals' && page === 'manager') ? 'active' : ''
              }
              key={n.id}
              onClick={() => {
                setPage(n.id);
                setSearch('');
              }}
              title={n.label}
            >
              <n.icon size={18} />
              <span className="hide-small">{n.label}</span>
              {n.id === 'approvals' && pending.length > 0 && (
                <span className="nav-count">{pending.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="guard-card hide-small">
            <div className="guard-orb">
              <ShieldCheck size={23} />
            </div>
            <strong>Your brand. Protected.</strong>
            <p>
              Every great idea deserves
              <br />
              to stay true to your brand.
            </p>
            <button onClick={() => setPage('guidelines')}>
              Explore guidelines <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="settings-link" onClick={() => setPage('settings')}>
            <Settings size={18} />
            <span className="hide-small">Workspace settings</span>
          </button>
          <div className="profile">
            <span className="avatar">{avatarText}</span>
            <span className="hide-small">
              <strong>
                {demoSession
                  ? role === 'creator'
                    ? 'Nacheeket Shah'
                    : role === 'manager'
                      ? 'Alex Morgan'
                      : 'Workspace Admin'
                  : identity?.name || identity?.id || 'Workspace member'}
              </strong>
              <small>
                {role.charAt(0).toUpperCase() + role.slice(1)}
                {demoSession ? ' · Demo persona' : ''}
              </small>
            </span>
            <button aria-label="Toggle sidebar" onClick={() => setCollapsed(!collapsed)}>
              <PanelLeftClose size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{pageTitle}</strong>
          </div>
          <div className="top-actions">
            <button
              className="tour-launch"
              aria-label="Take a tour"
              onClick={() => {
                tourReturnPage.current = page;
                setPage('workspace');
                setTourOpen(true);
              }}
            >
              <BookOpen size={18} />
              <span>Take a tour</span>
            </button>
            <ThemeToggle />
            <span className="system-state">
              <i />
              {health?.browser ? 'Browser demo' : 'API connected'}
            </span>
            {demoSession ? (
              <label className="role-select">
                <span className="sr-only">Demo persona</span>
                <select value={role} onChange={(e) => void changeRole(e.target.value as Role)}>
                  <option value="creator">Creator view</option>
                  <option value="manager">Manager view</option>
                  <option value="admin">Admin view</option>
                </select>
              </label>
            ) : null}
            <button
              disabled={busy}
              onClick={async () => {
                try {
                  await api.logout();
                  setLogged(false);
                  setIdentity(null);
                  setDemoSession(false);
                  setReview(null);
                  setReviews([]);
                  setGs([]);
                  setToast('');
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
            <span className="avatar mini">{avatarText}</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="tiny-square" /> BRAND INTELLIGENCE PLATFORM
              </div>
              <h1>
                {page === 'workspace' ? (
                  <>
                    Create with confidence<span>.</span>
                  </>
                ) : (
                  pageTitle
                )}
              </h1>
              <p>
                {page === 'workspace'
                  ? 'Your ideas, your voice. A little help keeping everything on brand.'
                  : page === 'guidelines'
                    ? 'One source of truth for every word, claim, and creative decision.'
                    : page === 'approvals'
                      ? 'A final human check before your next great idea goes live.'
                      : page === 'history'
                        ? 'Every review, decision, and revision. All in one place.'
                        : page === 'manager'
                          ? 'Review the changes. Understand the context. Make the call.'
                          : page === 'handoff'
                            ? 'Share the context behind your creative decisions.'
                            : 'Your environment, access, and review engine.'}
              </p>
            </div>
            {page === 'workspace' ? (
              <button
                className="secondary new-draft"
                onClick={newDraft}
                disabled={role !== 'creator'}
              >
                <Plus size={16} /> New draft
              </button>
            ) : page === 'guidelines' ? (
              <button
                className="primary"
                disabled={role === 'creator' || busy}
                onClick={() => uploader.current?.click()}
              >
                <Upload size={16} /> Upload guideline
              </button>
            ) : page === 'history' ? (
              <button className="secondary" onClick={newDraft} disabled={role !== 'creator'}>
                <Plus size={16} /> New draft
              </button>
            ) : null}
          </div>
          {health?.browser && (
            <div className="demo-banner">
              <Info size={15} />
              <span>
                <strong>Offline demo</strong> · Runs locally in your browser. Rule-based findings,
                simulated roles, and local storage. Start FastAPI for PDF ingestion and RAG.
              </span>
              <button onClick={() => setPage('settings')}>
                Details <ArrowUpRight size={13} />
              </button>
            </div>
          )}
          {page === 'workspace' && (
            <>
              <div className="overview-grid">
                <div className="overview-card">
                  <span className="stat-icon violet">
                    <FileText size={19} />
                  </span>
                  <div>
                    <small>Workspace reviews</small>
                    <strong>{reviews.length.toString().padStart(2, '0')}</strong>
                  </div>
                  <span className="stat-note">
                    All your drafts <ArrowUpRight size={13} />
                  </span>
                </div>
                <div className="overview-card">
                  <span className="stat-icon cyan">
                    <BookOpen size={19} />
                  </span>
                  <div>
                    <small>Active guidelines</small>
                    <strong>{activeGs.length.toString().padStart(2, '0')}</strong>
                  </div>
                  <span className="stat-note">
                    <i className="dot green" /> Ready to review
                  </span>
                </div>
                <div className="overview-card">
                  <span className="stat-icon green">
                    <ShieldCheck size={19} />
                  </span>
                  <div>
                    <small>Approved for publication</small>
                    <strong>
                      {reviews
                        .filter((r) => r.status === 'approved')
                        .length.toString()
                        .padStart(2, '0')}
                    </strong>
                  </div>
                  <span className="stat-note">
                    Human approved <Check size={13} />
                  </span>
                </div>
              </div>
              <div className="workspace-title">
                <div>
                  <h2>
                    Content review{' '}
                    <Badge kind="violet">
                      {review?.status === 'approved'
                        ? 'Approved'
                        : review?.status === 'pending'
                          ? 'In approval'
                          : 'Draft workspace'}
                    </Badge>
                  </h2>
                  <span>Catch the small things. Protect the big picture.</span>
                </div>
                <button className="quiet" onClick={() => setPage('history')}>
                  <History size={15} /> View history <ArrowUpRight size={13} />
                </button>
              </div>
              <div className="review-grid">
                <section className="panel editor-panel">
                  <div className="panel-header">
                    <div>
                      <span className="panel-icon">
                        <FileText size={17} />
                      </span>
                      <h3>Your draft</h3>
                    </div>
                    <div className="editor-modes">
                      <button
                        className={view === 'edit' ? 'current' : ''}
                        onClick={() => setView('edit')}
                      >
                        <PenLine size={13} /> Edit
                      </button>
                      <button
                        className={view === 'review' ? 'current' : ''}
                        onClick={() => setView('review')}
                      >
                        <Eye size={13} /> Review
                      </button>
                    </div>
                  </div>
                  <div className="draft-meta">
                    <label className="field-inline">
                      Content type
                      <select
                        value={draft.channel}
                        disabled={!editable || busy}
                        onChange={(e) => setDraft({ ...draft, channel: e.target.value })}
                      >
                        <option>LinkedIn post</option>
                        <option>Marketing email</option>
                        <option>Website copy</option>
                        <option>Press release</option>
                        <option>Social campaign</option>
                      </select>
                    </label>
                    <span className="save-state">
                      <i />
                      {isStale ? 'Not audited' : review ? 'Revision saved' : 'Ready to write'}
                    </span>
                  </div>
                  <div className="document">
                    <input
                      className="draft-title"
                      aria-label="Draft title"
                      value={draft.title}
                      disabled={!editable || busy}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    />
                    <div className="document-rule" />
                    {view === 'edit' ? (
                      <textarea
                        ref={editor}
                        aria-label="Draft content"
                        className="draft-text"
                        placeholder="Start writing your next great idea…"
                        value={draft.text}
                        disabled={!editable || busy}
                        onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                      />
                    ) : (
                      <div className="draft-render">
                        {draft.text ? (
                          highlighted()
                        ) : (
                          <button className="empty-editor" onClick={() => setView('edit')}>
                            Your next great idea starts here. Click to write.
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {showAsset && (
                    <div className="asset-options">
                      <div className="row-between">
                        <strong>Visual identity check</strong>
                        <button
                          onClick={() => setShowAsset(false)}
                          aria-label="Close visual settings"
                        >
                          <X size={15} />
                        </button>
                      </div>
                      <p>Metadata is self-declared. Image inspection requires live AI.</p>
                      <div className="asset-fields">
                        <label>
                          Colors (comma-separated)
                          <input
                            placeholder="#8B5CF6, #22D3EE"
                            value={draft.visual.colors.join(', ')}
                            disabled={!editable}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                visual: {
                                  ...draft.visual,
                                  colors: e.target.value
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                },
                              })
                            }
                          />
                        </label>
                        <label>
                          Logo position
                          <select
                            value={draft.visual.logoPosition}
                            disabled={!editable}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                visual: { ...draft.visual, logoPosition: e.target.value },
                              })
                            }
                          >
                            <option value="">Not supplied</option>
                            {['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'].map(
                              (p) => (
                                <option key={p}>{p}</option>
                              ),
                            )}
                          </select>
                        </label>
                      </div>
                      {draft.visual.image ? (
                        <div className="asset-preview">
                          <img src={draft.visual.image} alt="Attached campaign asset" />
                          <button
                            className="quiet"
                            disabled={!editable}
                            onClick={() =>
                              setDraft({ ...draft, visual: { ...draft.visual, image: '' } })
                            }
                          >
                            Remove asset <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          className="secondary"
                          disabled={!editable}
                          onClick={() => assetUpload.current?.click()}
                        >
                          <Upload size={14} /> Attach artwork
                        </button>
                      )}
                    </div>
                  )}
                  <div className="editor-footer">
                    <span>
                      {draft.text.trim() ? draft.text.trim().split(/\s+/).length : 0} words <b>·</b>{' '}
                      {draft.text.length} characters
                    </span>
                    <button className="quiet" onClick={() => setShowAsset(!showAsset)}>
                      <ImageIcon size={15} />
                      {draft.visual.image ? 'Asset attached' : 'Add visual asset'}
                    </button>
                  </div>
                  <div className="run-area">
                    <button
                      className="primary run-button"
                      disabled={busy || role !== 'creator' || !draft.text.trim()}
                      onClick={() => void run()}
                    >
                      {busy ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />}{' '}
                      {busy ? 'Reviewing your draft…' : 'Run Compliance Audit'}
                      <span>⌘ ↵</span>
                    </button>
                    <p>
                      <ShieldCheck size={12} />{' '}
                      {health?.aiMode === 'live'
                        ? 'Grounded in your active guidelines · AI-assisted review'
                        : health?.browser
                          ? 'Offline rules engine · Stored in this browser'
                          : 'Offline rules engine · Stored on your local server'}
                    </p>
                  </div>
                </section>
                <section className="panel analysis-panel">
                  <div className="panel-header">
                    <div>
                      <span className="panel-icon violet">
                        <Sparkles size={17} />
                      </span>
                      <h3>AI audit analysis</h3>
                    </div>
                    <Badge kind={review && !isStale ? 'green' : 'neutral'}>
                      <i className="dot" />
                      {busy ? 'Analyzing' : review && !isStale ? 'Audit complete' : 'Ready'}
                    </Badge>
                  </div>
                  <div className="score-section">
                    <Ring score={review && !isStale ? review.score : 0} />
                    <div>
                      <div className="score-label">
                        Brand alignment <Info size={12} />
                      </div>
                      <h3>
                        {!review
                          ? 'Let’s find your fit'
                          : isStale
                            ? 'A fresh look is needed'
                            : review.score >= 90
                              ? 'Looking good. Very you.'
                              : review.score >= 60
                                ? 'Good ideas. A few refinements.'
                                : 'A little more alignment.'}
                      </h3>
                      <p>
                        {!review
                          ? 'Run an audit to see how your content aligns.'
                          : isStale
                            ? 'Your draft changed. Run the audit again.'
                            : `${openCount} open · ${review.issues.filter((i) => i.status === 'accepted').length} accepted · ${rejected} rejected`}
                      </p>
                    </div>
                  </div>
                  <div className="analysis-tabs">
                    {['All findings', 'High priority', 'Resolved'].map((t) => (
                      <button
                        className={tab === t ? 'active' : ''}
                        key={t}
                        onClick={() => setTab(t)}
                      >
                        {t}
                        {t === 'All findings' && review && (
                          <span>{review.issues.filter((i) => i.status !== 'accepted').length}</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="findings" aria-live="polite">
                    {busy && !review ? (
                      <div className="empty-state">
                        <div className="empty-orb">
                          <LoaderCircle className="spin" />
                        </div>
                        <h3>Connecting the dots.</h3>
                        <p>Retrieving guidelines and reviewing your draft.</p>
                      </div>
                    ) : !review || isStale ? (
                      <div className="empty-state">
                        <div className="empty-orb">
                          <Sparkles size={27} />
                        </div>
                        <h3>
                          {isStale
                            ? 'Ready for another look?'
                            : 'Great work starts with a little clarity.'}
                        </h3>
                        <p>
                          {isStale
                            ? 'Run a new audit to refresh findings for your latest revision.'
                            : 'Your brand review will appear here. We’ll check tone, facts, terminology, and visual identity.'}
                        </p>
                        <div className="empty-checks">
                          <span>
                            <Check size={13} /> Cited rules
                          </span>
                          <span>
                            <Check size={13} /> Helpful rewrites
                          </span>
                          <span>
                            <Check size={13} /> You’re in control
                          </span>
                        </div>
                        {!review && (
                          <button
                            className="quiet"
                            disabled={role !== 'creator'}
                            onClick={() => {
                              setDraft(sampleDraft);
                              setReview(null);
                              notify('Sample campaign loaded. Run the audit to explore.');
                            }}
                          >
                            Try the sample draft <ArrowRight size={14} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        {review.issues
                          .filter((i) =>
                            tab === 'Resolved'
                              ? i.status === 'accepted'
                              : tab === 'High priority'
                                ? i.severity === 'high' && i.status !== 'accepted'
                                : i.status !== 'accepted',
                          )
                          .map((i, index) => (
                            <article
                              id={'finding-' + i.id}
                              className={`finding ${i.severity} ${selected === i.id ? 'focused' : ''} ${i.status === 'accepted' ? 'resolved' : ''}`}
                              key={i.id}
                              onClick={() => setSelected(i.id)}
                            >
                              <div className="finding-top">
                                <div>
                                  <span className={`severity-dot ${i.severity}`} />
                                  <strong>{i.ruleCategory}</strong>
                                </div>
                                <Badge kind={i.severity}>
                                  {i.status === 'accepted'
                                    ? 'Resolved'
                                    : i.status === 'rejected'
                                      ? 'Rejected'
                                      : i.severity === 'high'
                                        ? 'High priority'
                                        : i.severity === 'medium'
                                          ? 'Suggestion'
                                          : 'Refinement'}
                                </Badge>
                              </div>
                              <blockquote>“{i.flaggedText}”</blockquote>
                              <p>{i.explanation}</p>
                              <button
                                className="citation"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPage('guidelines');
                                  setSearch(i.ruleCitation);
                                }}
                              >
                                <BookOpen size={12} />
                                {i.ruleCitation}
                                <ArrowUpRight size={11} />
                              </button>
                              <div className="suggested">
                                <div>
                                  <Sparkles size={11} /> SUGGESTED REWRITE
                                  {review.mode === 'live' ? ' · AI' : ' · RULE-BASED'}
                                </div>
                                <p>{i.suggestedRewrite}</p>
                              </div>
                              <div className="finding-actions">
                                <span>
                                  {String(index + 1).padStart(2, '0')} /{' '}
                                  {String(review.issues.length).padStart(2, '0')}
                                </span>
                                {i.status === 'open' ? (
                                  <>
                                    <button
                                      className="reject"
                                      disabled={busy || !editable}
                                      onClick={() => void action('reject', i.id)}
                                    >
                                      <X size={13} /> Reject
                                    </button>
                                    <button
                                      className="accept"
                                      disabled={busy || !editable || i.target === 'visual'}
                                      title={
                                        i.target === 'visual'
                                          ? 'Update artwork and re-audit to resolve'
                                          : 'Accept this rewrite'
                                      }
                                      onClick={() => void action('accept', i.id)}
                                    >
                                      <Check size={13} />{' '}
                                      {i.target === 'visual' ? 'Re-audit asset' : 'Accept rewrite'}
                                    </button>
                                  </>
                                ) : i.status === 'rejected' ? (
                                  <button
                                    className="quiet"
                                    disabled={busy || !editable}
                                    onClick={() => void action('reopen', i.id)}
                                  >
                                    <RotateCcw size={13} /> Reopen
                                  </button>
                                ) : (
                                  <span className="text-green">
                                    <Check size={13} /> Rewrite accepted
                                  </span>
                                )}
                              </div>
                            </article>
                          ))}
                        {!review.issues.some((i) =>
                          tab === 'Resolved'
                            ? i.status === 'accepted'
                            : tab === 'High priority'
                              ? i.severity === 'high' && i.status !== 'accepted'
                              : i.status !== 'accepted',
                        ) && (
                          <div className="empty-state compact">
                            <div className="empty-orb success">
                              <CheckCheck size={26} />
                            </div>
                            <h3>
                              {tab === 'Resolved'
                                ? 'No accepted rewrites yet.'
                                : tab === 'High priority'
                                  ? 'No high-priority findings.'
                                  : 'All clear. Ready for a human review.'}
                            </h3>
                            <p>
                              {tab === 'Resolved'
                                ? 'Accepted suggestions will appear here.'
                                : 'A review supports your judgment; it does not guarantee compliance.'}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="analysis-footer">
                    <span>
                      <Link2 size={13} /> {activeGs.length} active guideline sources
                    </span>
                    <span>{review?.mode === 'live' ? 'LLM agents' : 'Offline engine'}</span>
                  </div>
                </section>
              </div>
              <div className="handoff panel">
                <div className="handoff-icon">
                  <Send size={19} />
                </div>
                <div>
                  <h3>
                    {review?.status === 'approved'
                      ? 'Signed off and ready to publish.'
                      : review?.status === 'pending'
                        ? 'Your draft is with the manager.'
                        : 'The final word is always human.'}
                  </h3>
                  <p>
                    {rejected
                      ? `${rejected} rejected finding${rejected > 1 ? 's' : ''} remain${rejected === 1 ? 's' : ''} a risk and will block final sign-off.`
                      : 'Resolve findings, add context, and send your draft for manager approval.'}
                  </p>
                </div>
                <button
                  className="secondary"
                  disabled={
                    !review ||
                    busy ||
                    isStale ||
                    openCount > 0 ||
                    !['draft', 'returned'].includes(review.status) ||
                    role !== 'creator'
                  }
                  onClick={() => {
                    setComment('');
                    setPage('handoff');
                  }}
                >
                  Send for manager approval <ArrowRight size={15} />
                </button>
              </div>
              <div className="bottom-note">
                <ShieldCheck size={13} />
                <span>Built to support your creativity. Every change stays in your hands.</span>
                <span className="right-note">
                  {health?.vectorStore} <span>·</span>{' '}
                  {health?.aiMode === 'live' ? 'Live AI' : 'Offline review'}{' '}
                  <i className="dot green" />
                </span>
              </div>
            </>
          )}
          {page === 'guidelines' && (
            <>
              <div className="source-summary panel">
                <span className="stat-icon violet">
                  <BookOpen />
                </span>
                <div>
                  <h3>A brand book that works with you.</h3>
                  <p>
                    {activeGs.length} active sources · Markdown, PDF, or structured JSON · Up to 4
                    MB each
                  </p>
                </div>
                <Badge kind="green">
                  {health?.browser ? 'Local demo sources' : 'FAISS retrieval'}
                </Badge>
              </div>
              <div className="search-row">
                <label className="search">
                  <Search size={17} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search guidelines, categories, or citations…"
                  />
                </label>
                <span>{gs.length} sources</span>
              </div>
              <div className="guideline-grid">
                {gs
                  .filter((g) =>
                    (g.title + g.content + g.citation).toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((g) => (
                    <article className="panel guideline" key={g.id}>
                      <div className="row-between">
                        <span className={`stat-icon ${g.id === 'visual' ? 'cyan' : 'violet'}`}>
                          {g.id === 'visual' ? <ImageIcon size={21} /> : <BookOpen size={21} />}
                        </span>
                        <Badge kind={g.active ? 'green' : 'neutral'}>
                          {g.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <small>{g.category}</small>
                      <h2>{g.title}</h2>
                      <div className="citation">
                        <BookOpen size={12} />
                        {g.citation}
                      </div>
                      <p>{g.content}</p>
                      {(g.colors?.length || 0) > 0 && (
                        <div className="swatches">
                          {g.colors!.map((c) => (
                            <span key={c}>
                              <i style={{ background: c }} />
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                      <footer>
                        <span>{g.rules?.length || 0} offline rules</span>
                        <button
                          className="quiet"
                          disabled={role === 'creator' || busy}
                          onClick={async () => {
                            try {
                              await api.toggle(g.id, !g.active);
                              await refresh();
                              notify(
                                g.active
                                  ? 'Guideline deactivated. Existing reviews require a new audit.'
                                  : 'Guideline activated.',
                              );
                            } catch (e) {
                              notify((e as Error).message);
                            }
                          }}
                        >
                          {g.active ? 'Deactivate' : 'Activate'} <ArrowRight size={13} />
                        </button>
                      </footer>
                    </article>
                  ))}
              </div>
              <div className="info-box">
                <Info size={18} />
                <p>
                  <strong>Offline rule coverage is explicit.</strong> Plain Markdown and PDF sources
                  are available to live AI retrieval. To enforce new rules offline, upload
                  structured JSON with literal match patterns. See the sample schema in the
                  repository.
                </p>
              </div>
            </>
          )}
          {(page === 'history' || page === 'approvals') && (
            <>
              <div className="search-row">
                <label className="search">
                  <Search size={17} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Find a draft by title…"
                  />
                </label>
                <span>{page === 'approvals' ? pending.length : reviews.length} reviews</span>
              </div>
              <div className="panel review-table">
                <div className="table-head">
                  <span>CONTENT</span>
                  <span>ALIGNMENT</span>
                  <span>STATUS</span>
                  <span>LAST ACTIVITY</span>
                  <span />
                </div>
                {(page === 'approvals' ? pending : reviews)
                  .filter((r) => r.title.toLowerCase().includes(search.toLowerCase()))
                  .map((r) => (
                    <button
                      className="table-row"
                      key={r.id}
                      onClick={() => openReview(r, role !== 'creator')}
                    >
                      <span>
                        <FileText size={18} />
                        <span>
                          <strong>{r.title}</strong>
                          <small>
                            {r.channel} · Revision {r.version}
                          </small>
                        </span>
                      </span>
                      <span className={r.score >= 85 ? 'text-green' : 'text-amber'}>
                        {r.score}%
                      </span>
                      <span>
                        <Badge
                          kind={
                            r.status === 'approved'
                              ? 'green'
                              : r.status === 'pending'
                                ? 'violet'
                                : 'neutral'
                          }
                        >
                          {r.status === 'pending' ? 'Awaiting approval' : r.status}
                        </Badge>
                      </span>
                      <span>{ago(r.events.at(-1)?.at || r.createdAt)}</span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                {!(page === 'approvals' ? pending : reviews).length && (
                  <div className="empty-state">
                    <div className="empty-orb">
                      <CheckCheck size={28} />
                    </div>
                    <h3>
                      {page === 'approvals' ? 'You’re all caught up.' : 'Your story starts here.'}
                    </h3>
                    <p>
                      {page === 'approvals'
                        ? 'Submitted drafts will appear here for manager review.'
                        : 'Run your first audit to create a traceable review history.'}
                    </p>
                  </div>
                )}
              </div>
              {page === 'approvals' && role === 'creator' && (
                <div className="info-box">
                  <Info size={18} />
                  <p>
                    Creators can track submissions here.{' '}
                    {demoSession
                      ? 'Switch to Manager view to try the sign-off workflow.'
                      : 'An authorized manager must sign off your draft.'}
                  </p>
                </div>
              )}
            </>
          )}
          {page === 'handoff' && review && (
            <div className="panel handoff-form">
              <Send className="text-violet" size={30} />
              <h2>Ready for a second pair of eyes.</h2>
              <p>
                Add context for your manager. Your current revision and its audit trail will be
                locked when submitted.
              </p>
              <label>
                Message to the reviewer
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={3000}
                  placeholder="Campaign context, decisions, or questions for your reviewer…"
                />
              </label>
              {rejected > 0 && (
                <div className="info-box">
                  <AlertTriangle size={18} />
                  <p>
                    {rejected} rejected findings remain. The manager can request changes, but cannot
                    approve unresolved risks.
                  </p>
                </div>
              )}
              <div className="row-between">
                <button className="secondary" onClick={() => setPage('workspace')}>
                  Back to draft
                </button>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={async () => {
                    await action('submit');
                    setPage('workspace');
                  }}
                >
                  Send for approval <Send size={15} />
                </button>
              </div>
            </div>
          )}
          {page === 'manager' && review && (
            <>
              <div className="panel manager-summary">
                <Ring score={review.score} size={80} />
                <div>
                  <h2>{review.title}</h2>
                  <p>
                    {review.channel} · Revision {review.version} · {review.owner}
                  </p>
                  <Badge kind={review.status === 'approved' ? 'green' : 'violet'}>
                    {review.status === 'pending' ? 'Awaiting your approval' : review.status}
                  </Badge>
                </div>
                <button className="secondary" onClick={() => download(review)}>
                  <Download size={15} /> Export audit
                </button>
              </div>
              <div className="manager-grid">
                <section className="panel">
                  <div className="panel-header">
                    <h3>Revision comparison</h3>
                    <Badge>Original → Current</Badge>
                  </div>
                  <div className="diff-legend">
                    <span>
                      <i className="dot high" /> Removed
                    </span>
                    <span>
                      <i className="dot green" /> Added
                    </span>
                  </div>
                  <div className="diff">
                    {diffWords(review.original, review.text).map((p, i) => (
                      <span key={i} className={p.added ? 'added' : p.removed ? 'removed' : ''}>
                        {p.value}
                      </span>
                    ))}
                  </div>
                  <div className="manager-context">
                    <h3>Creator context</h3>
                    <p>{review.comment || 'No additional context supplied.'}</p>
                    <h3>Visual coverage</h3>
                    <p>{review.visualCoverage}</p>
                    {review.visual.image && (
                      <img
                        className="manager-image"
                        src={review.visual.image}
                        alt="Reviewed artwork"
                      />
                    )}
                    {review.issues
                      .filter((i) => i.status !== 'accepted')
                      .map((i) => (
                        <div className="risk" key={i.id}>
                          <AlertTriangle size={16} />
                          <p>
                            <strong>{i.flaggedText}</strong> · {i.status}
                            <br />
                            {i.explanation}
                            <br />
                            <small>{i.ruleCitation}</small>
                          </p>
                        </div>
                      ))}
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-header">
                    <h3>Audit trail</h3>
                    <History size={17} />
                  </div>
                  <div className="timeline">
                    {review.events
                      .slice()
                      .reverse()
                      .map((e) => (
                        <div key={e.id}>
                          <span className="timeline-node" />
                          <small>
                            {ago(e.at)} · v{e.version}
                          </small>
                          <strong>{e.action}</strong>
                          <p>{e.detail}</p>
                          <span>
                            {e.actor} · {e.role}
                          </span>
                        </div>
                      ))}
                  </div>
                </section>
              </div>
              <div className="panel signoff">
                <div>
                  <h2>A human decision. A clear record.</h2>
                  <p>
                    Sign-off is recorded against this exact revision. Nothing is automatically
                    published.
                  </p>
                  <textarea
                    aria-label="Manager feedback"
                    placeholder="Add sign-off notes or explain the changes needed…"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    maxLength={3000}
                  />
                </div>
                <div>
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      role === 'creator' ||
                      review.status !== 'pending' ||
                      review.issues.some((i) => i.status !== 'accepted') ||
                      (!!review.visual.image && review.visualCoverage !== 'image + metadata')
                    }
                    onClick={() => void action('approve')}
                  >
                    <ShieldCheck size={16} /> Approve for publication
                  </button>
                  <button
                    className="secondary"
                    disabled={
                      busy || role === 'creator' || review.status !== 'pending' || !comment.trim()
                    }
                    onClick={() => void action('return')}
                  >
                    <MessageSquare size={16} /> Request changes
                  </button>
                </div>
              </div>
            </>
          )}
          {page === 'settings' && (
            <div className="settings-grid">
              <section className="panel settings-card">
                <span className="stat-icon violet">
                  <Settings />
                </span>
                <h2>Review environment</h2>
                <a className="secondary source-download" href="/brandguard-ai-source.zip" download>
                  <Download size={14} /> Download full source
                </a>
                <dl>
                  <dt>Connection</dt>
                  <dd>{health?.browser ? 'Browser-only demonstration' : 'FastAPI connected'}</dd>
                  <dt>AI engine</dt>
                  <dd>{health?.aiMode}</dd>
                  <dt>Vector store</dt>
                  <dd>{health?.vectorStore}</dd>
                  <dt>Identity</dt>
                  <dd>{demoSession ? 'Simulated demo personas' : 'Authenticated session'}</dd>
                  <dt>Persistence</dt>
                  <dd>{health?.browser ? 'This browser’s local storage' : 'Server database'}</dd>
                </dl>
                <p>
                  API keys stay on the backend. Live provider failures stop the audit rather than
                  silently issuing an offline compliance result.
                </p>
              </section>
              <section className="panel settings-card">
                <span className="stat-icon cyan">
                  <ShieldCheck />
                </span>
                <h2>Understand your score</h2>
                <p>
                  Alignment is a transparent weighted review metric, not a calibrated probability of
                  compliance.
                </p>
                <div className="score-breakdown">
                  <span>
                    <Badge kind="high">High</Badge> −12 points
                  </span>
                  <span>
                    <Badge kind="medium">Medium</Badge> −7 points
                  </span>
                  <span>
                    <Badge kind="low">Low</Badge> −3 points
                  </span>
                </div>
                <p>
                  Accepted rewrites remove a finding’s penalty. Rejected suggestions keep their
                  penalty and block final sign-off. Editing the draft requires a fresh audit.
                </p>
                <p>
                  Offline mode checks explicit rules and declared visual metadata. It does not read
                  images or interpret arbitrary prose guidelines.
                </p>
              </section>
            </div>
          )}
        </main>
        <footer className="app-footer">
          <span>
            <ShieldCheck size={13} /> BrandGuard AI
          </span>
          <span>Thoughtful content. Consistent brands.</span>
          <span>
            MVP 1.0 <i className="dot green" />
          </span>
        </footer>
      </div>
      <input
        ref={uploader}
        type="file"
        accept=".md,.txt,.pdf,.json"
        hidden
        onChange={(e) => {
          if (e.target.files?.[0]) void uploadGuideline(e.target.files[0]);
        }}
      />
      <input
        ref={assetUpload}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          if (e.target.files?.[0]) void attach(e.target.files[0]);
          e.target.value = '';
        }}
      />
      {tourOpen && (
        <Walkthrough
          onClose={() => {
            setTourOpen(false);
            setPage(tourReturnPage.current);
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Info size={17} />
          <span>{toast}</span>
          <button aria-label="Dismiss notification" onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

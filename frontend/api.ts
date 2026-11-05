import { offline } from './offline';
import type { Action, Draft, Guideline, Review, Role, Identity } from './types';
let browser = false;
let role: Role = 'creator';
export function setRole(value: Role) {
  role = value;
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch('/api/v1' + path, {
    ...options,
    credentials: 'same-origin',
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      'X-Demo-Role': role,
      ...options.headers,
    },
    signal: AbortSignal.timeout(150000),
  });
  if (!res.ok) {
    let detail = 'Request failed';
    try {
      const data = await res.json();
      detail = typeof data.detail === 'string' ? data.detail : 'Please check the submitted fields.';
    } catch {
      detail = `Request failed (${res.status})`;
    }
    throw new Error(detail);
  }
  return res.json();
}
export const api = {
  init: async () => {
    try {
      const h = await request<{
        demo: boolean;
        registrationEnabled: boolean;
        aiMode: string;
        vectorStore: string;
      }>('/health');
      return { ...h, browser: false };
    } catch {
      browser = true;
      return {
        demo: true,
        registrationEnabled: false,
        aiMode: 'browser demo',
        vectorStore: 'Local rules',
        browser: true,
      };
    }
  },
  me: () =>
    browser ? Promise.reject(new Error('Backend unavailable')) : request<Identity>('/auth/me'),
  login: (email: string, password: string) =>
    browser
      ? Promise.reject(new Error('Start the FastAPI backend to sign in, or explore the demo.'))
      : request<Identity>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        }),
  register: (name: string, email: string, password: string) =>
    browser
      ? Promise.reject(
          new Error(
            'Registration requires the FastAPI backend. You can explore the demo without an account.',
          ),
        )
      : request<Identity>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password }),
        }),
  logout: () =>
    browser ? Promise.resolve({ ok: true }) : request('/auth/logout', { method: 'POST' }),
  guidelines: () => (browser ? offline.guidelines() : request<Guideline[]>('/guidelines')),
  reviews: () => (browser ? offline.reviews() : request<Review[]>('/reviews')),
  review: (d: Draft) =>
    browser
      ? offline.review(d)
      : request<Review>('/review', { method: 'POST', body: JSON.stringify(d) }),
  action: (r: Review, action: Action, issueId = '', comment = '') =>
    browser
      ? offline.action(r.id, action, issueId, r.version, comment, role)
      : request<Review>(`/reviews/${r.id}/actions`, {
          method: 'POST',
          body: JSON.stringify({ version: r.version, action, issueId, comment }),
        }),
  toggle: (id: string, active: boolean) =>
    browser
      ? offline.toggle(id, active)
      : request<Guideline>(`/guidelines/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ active }),
        }),
  upload: async (file: File) => {
    if (browser) {
      if (file.size > 4000000) throw new Error('Maximum guideline size is 4 MB');
      if (file.name.toLowerCase().endsWith('.pdf'))
        throw new Error(
          'PDF ingestion requires the FastAPI backend. Use Markdown or structured JSON in browser demo.',
        );
      const text = await file.text();
      let g: Guideline;
      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        if (!parsed.title || !parsed.content || !parsed.citation)
          throw new Error('JSON needs title, content, citation, and optional literal rules.');
        g = {
          ...parsed,
          id: crypto.randomUUID(),
          active: true,
          rules: (parsed.rules || []).map((r: { pattern: string }) => ({
            ...r,
            pattern: r.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          })),
        };
      } else
        g = {
          id: crypto.randomUUID(),
          title: file.name,
          category: 'Custom guideline',
          citation: 'Source: ' + file.name,
          content: text,
          active: true,
          rules: [],
        };
      if (!g.content.trim()) throw new Error('Guideline is empty');
      return offline.guideline(g);
    }
    const body = new FormData();
    body.append('file', file);
    return request<Guideline>('/guidelines/upload', { method: 'POST', body });
  },
};

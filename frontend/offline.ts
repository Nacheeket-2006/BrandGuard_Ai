import seed from './shared/guidelines.json';
import type { Action, Draft, GovernanceInsights, Guideline, Issue, Review, Role } from './types';
const id = () => crypto.randomUUID();
const key = 'brandguard-demo-v1';
interface Store {
  guidelines: Guideline[];
  reviews: Review[];
}
function load(): Store {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const store = JSON.parse(raw) as Store;
      const seeded = structuredClone(seed) as Guideline[];
      for (const guideline of seeded)
        if (!store.guidelines.some((existing) => existing.id === guideline.id))
          store.guidelines.push(guideline);
      const visual = store.guidelines.find((guideline) => guideline.id === 'visual');
      const visualSeed = seeded.find((guideline) => guideline.id === 'visual');
      if (visual && visual.minContrastRatio === undefined && visualSeed?.minContrastRatio)
        visual.minContrastRatio = visualSeed.minContrastRatio;
      return store;
    }
  } catch {
    throw new Error('Browser storage is unavailable. Enable local storage or start the backend.');
  }
  return { guidelines: structuredClone(seed) as Guideline[], reviews: [] };
}
function save(s: Store) {
  try {
    localStorage.setItem(key, JSON.stringify(s));
  } catch {
    throw new Error('Demo storage is full. Use a smaller image or connect the backend.');
  }
}
const policy = (gs: Guideline[]) => JSON.stringify(gs);
function relativeLuminance(color: string) {
  const channels = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16) / 255);
  const linear = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
function contrastRatio(first: string, second: string) {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}
export const alignment = (issues: Issue[]) =>
  Math.max(
    0,
    100 -
      issues
        .filter((i) => i.status !== 'accepted')
        .reduce((n, i) => n + { high: 12, medium: 7, low: 3 }[i.severity], 0),
  );
export function analyzeLocal(draft: Draft, gs: Guideline[]): Issue[] {
  const issues: Issue[] = [];
  for (const g of gs.filter((g) => g.active)) {
    for (const rule of g.rules || [])
      for (const m of draft.text.matchAll(new RegExp(rule.pattern, 'gi'))) {
        if (m[0].toLowerCase() === rule.allowed?.toLowerCase()) continue;
        issues.push({
          id: id(),
          startIndex: m.index!,
          endIndex: m.index! + m[0].length,
          flaggedText: m[0],
          ruleCategory: g.category,
          ruleCitation: g.citation,
          explanation: rule.explanation,
          suggestedRewrite: rule.replacement,
          severity: rule.severity,
          target: 'text',
          status: 'open',
        });
      }
    if (g.colors?.length) {
      for (const m of draft.text.matchAll(/#[0-9a-f]{6}\b/gi))
        if (!g.colors.includes(m[0].toUpperCase()))
          issues.push({
            id: id(),
            startIndex: m.index!,
            endIndex: m.index! + m[0].length,
            flaggedText: m[0],
            ruleCategory: 'Visual identity',
            ruleCitation: g.citation,
            explanation: 'This color is outside the approved brand palette.',
            suggestedRewrite: g.colors[0],
            severity: 'medium',
            target: 'text',
            status: 'open',
          });
      for (const color of draft.visual.colors)
        if (!g.colors.includes(color.toUpperCase()))
          issues.push({
            id: id(),
            startIndex: 0,
            endIndex: 0,
            flaggedText: color,
            ruleCategory: 'Visual identity',
            ruleCitation: g.citation,
            explanation:
              'The declared asset color is outside the approved palette. Update the artwork and re-audit.',
            suggestedRewrite: g.colors[0],
            severity: 'medium',
            target: 'visual',
            status: 'open',
          });
    }
    if (
      draft.visual.logoPosition &&
      g.logoPositions?.length &&
      !g.logoPositions.includes(draft.visual.logoPosition)
    )
      issues.push({
        id: id(),
        startIndex: 0,
        endIndex: 0,
        flaggedText: draft.visual.logoPosition,
        ruleCategory: 'Visual identity',
        ruleCitation: g.citation,
        explanation: 'Use an approved corner for the logo. Update the artwork and re-audit.',
        suggestedRewrite: g.logoPositions.join(' or '),
        severity: 'medium',
        target: 'visual',
        status: 'open',
      });
  }
  const accessibility = gs.find((g) => g.active && g.id === 'accessibility');
  if (accessibility) {
    const suppliedColors = [
      ...draft.visual.colors,
      ...Array.from(draft.text.matchAll(/#[0-9a-f]{6}\b/gi), (match) => match[0]),
    ];
    const colors = [
      ...new Set(
        suppliedColors
          .filter((color) => /^#[0-9a-f]{6}$/i.test(color))
          .map((color) => color.toUpperCase()),
      ),
    ];
    if (colors.length >= 2) {
      let highest = { ratio: 0, first: '', second: '' };
      for (let first = 0; first < colors.length; first++)
        for (let second = first + 1; second < colors.length; second++) {
          const ratio = contrastRatio(colors[first], colors[second]);
          if (ratio > highest.ratio)
            highest = { ratio, first: colors[first], second: colors[second] };
        }
      const minimum = gs.find((g) => g.id === 'visual')?.minContrastRatio ?? 4.5;
      if (highest.ratio < minimum)
        issues.push({
          id: id(),
          startIndex: 0,
          endIndex: 0,
          flaggedText: `${highest.first} and ${highest.second}`,
          ruleCategory: 'Accessibility',
          ruleCitation: accessibility.citation,
          explanation: `The highest contrast pair is ${highest.ratio.toFixed(2)}:1 < ${minimum}:1 WCAG AA. Pair colors with #FFFFFF or #0C0D14 from the approved palette to improve legibility.`,
          suggestedRewrite:
            'Pair with #FFFFFF or #0C0D14 from the approved palette, then re-audit.',
          severity: 'medium',
          target: 'visual',
          status: 'open',
        });
    }
  }
  let end = -1;
  return issues
    .sort((a, b) => a.startIndex - b.startIndex)
    .filter((i) => {
      if (i.target === 'visual') return true;
      if (i.startIndex < end) return false;
      end = i.endIndex;
      return true;
    });
}
export function aggregateInsights(reviews: Review[]): GovernanceInsights {
  const violations = new Map<string, GovernanceInsights['topViolations'][number]>();
  const guidelines = new Map<string, GovernanceInsights['unclearGuidelines'][number]>();
  const channels = new Map<
    string,
    GovernanceInsights['channelBreakdown'][number] & { scoreTotal: number }
  >();
  for (const review of reviews) {
    const channel = review.channel || 'Unknown';
    const channelData = channels.get(channel) || {
      channel,
      reviewCount: 0,
      averageScore: 0,
      scoreTotal: 0,
    };
    channelData.reviewCount++;
    channelData.scoreTotal += review.score;
    channels.set(channel, channelData);
    for (const issue of review.issues) {
      const violationKey = JSON.stringify([
        issue.ruleCitation,
        issue.ruleCategory,
        issue.flaggedText,
      ]);
      const violation = violations.get(violationKey) || {
        ruleCitation: issue.ruleCitation,
        ruleCategory: issue.ruleCategory,
        flaggedText: issue.flaggedText,
        count: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        openCount: 0,
      };
      violation.count++;
      if (issue.status === 'accepted') violation.acceptedCount++;
      if (issue.status === 'rejected') violation.rejectedCount++;
      if (issue.status === 'open') violation.openCount++;
      violations.set(violationKey, violation);
      const guidelineKey = JSON.stringify([issue.ruleCitation, issue.ruleCategory]);
      const guideline = guidelines.get(guidelineKey) || {
        ruleCitation: issue.ruleCitation,
        ruleCategory: issue.ruleCategory,
        totalCount: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        rejectionRate: 0,
      };
      guideline.totalCount++;
      if (issue.status === 'accepted') guideline.acceptedCount++;
      if (issue.status === 'rejected') guideline.rejectedCount++;
      guidelines.set(guidelineKey, guideline);
    }
  }
  const channelBreakdown = [...channels.values()]
    .map(({ scoreTotal, ...channel }) => ({
      ...channel,
      averageScore: Number((scoreTotal / channel.reviewCount).toFixed(2)),
    }))
    .sort((a, b) => a.channel.localeCompare(b.channel));
  const unclearGuidelines = [...guidelines.values()]
    .filter((guideline) => guideline.rejectedCount > 0)
    .map((guideline) => ({
      ...guideline,
      rejectionRate: guideline.rejectedCount / guideline.totalCount,
    }))
    .sort(
      (a, b) =>
        b.rejectionRate - a.rejectionRate ||
        b.totalCount - a.totalCount ||
        a.ruleCitation.localeCompare(b.ruleCitation),
    )
    .slice(0, 5);
  return {
    totalReviews: reviews.length,
    approvedCount: reviews.filter((review) => review.status === 'approved').length,
    returnedCount: reviews.filter((review) => review.status === 'returned').length,
    averageScore: reviews.length
      ? Number(
          (reviews.reduce((total, review) => total + review.score, 0) / reviews.length).toFixed(2),
        )
      : 0,
    topViolations: [...violations.values()]
      .sort(
        (a, b) =>
          b.count - a.count ||
          a.ruleCitation.localeCompare(b.ruleCitation) ||
          a.ruleCategory.localeCompare(b.ruleCategory) ||
          a.flaggedText.localeCompare(b.flaggedText),
      )
      .slice(0, 10),
    unclearGuidelines,
    channelBreakdown,
  };
}
export const offline = {
  guidelines: async () => load().guidelines,
  reviews: async () => load().reviews.sort((a, b) => b.createdAt - a.createdAt),
  insights: async () => aggregateInsights(load().reviews),
  guideline: async (g: Guideline) => {
    const s = load();
    s.guidelines.push(g);
    save(s);
    return g;
  },
  toggle: async (gid: string, active: boolean) => {
    const s = load();
    const g = s.guidelines.find((g) => g.id === gid)!;
    g.active = active;
    save(s);
    return g;
  },
  review: async (draft: Draft): Promise<Review> => {
    const s = load();
    if (!s.guidelines.some((g) => g.active))
      throw new Error('Activate a guideline before reviewing.');
    const issues = analyzeLocal(draft, s.guidelines);
    const r: Review = {
      ...structuredClone(draft),
      id: id(),
      original: draft.text,
      originalVisual: structuredClone(draft.visual),
      owner: 'demo-creator',
      createdAt: Date.now() / 1000,
      version: 1,
      status: 'draft',
      issues,
      score: alignment(issues),
      mode: 'browser demo',
      visualCoverage: draft.visual.image ? 'declared metadata only' : 'no asset supplied',
      context: s.guidelines.filter((g) => g.active).slice(0, 6),
      events: [],
      comment: '',
      policyHash: policy(s.guidelines),
    };
    r.events.push({
      id: id(),
      at: Date.now() / 1000,
      actor: 'demo-creator',
      role: 'creator',
      action: 'Audit completed',
      detail: `${issues.length} findings · browser rules engine`,
      version: 1,
    });
    s.reviews.push(r);
    save(s);
    return r;
  },
  action: async (
    rid: string,
    action: Action,
    issueId: string,
    version: number,
    comment: string,
    role: Role,
  ) => {
    const s = load(),
      r = s.reviews.find((r) => r.id === rid);
    if (!r) throw new Error('Review not found');
    if (r.version !== version) throw new Error('Review changed. Reopen it before continuing.');
    if (['approve', 'return'].includes(action)) {
      if (role === 'creator' || r.status !== 'pending')
        throw new Error('A manager can only sign off submitted reviews.');
      if (
        action === 'approve' &&
        (r.issues.some((i) => i.status !== 'accepted') || r.policyHash !== policy(s.guidelines))
      )
        throw new Error('Unresolved findings or changed guidelines prevent approval.');
      if (action === 'approve' && r.visual.image)
        throw new Error('Image sign-off requires the live Vision Agent.');
      if (action === 'return' && !comment.trim())
        throw new Error('Add a comment explaining the requested changes.');
      r.status = action === 'approve' ? 'approved' : 'returned';
    } else {
      if (role !== 'creator' || !['draft', 'returned'].includes(r.status))
        throw new Error('Switch to Creator to revise an editable draft.');
      if (action === 'submit') {
        if (r.issues.some((i) => i.status === 'open'))
          throw new Error('Resolve or reject open findings before handoff.');
        if (r.policyHash !== policy(s.guidelines))
          throw new Error('Guidelines changed. Run a new audit.');
        r.status = 'pending';
        r.comment = comment;
      } else {
        const i = r.issues.find((i) => i.id === issueId);
        if (!i) throw new Error('Finding not found');
        if (action === 'reopen') {
          if (i.status !== 'rejected') throw new Error('Only rejected findings can be reopened');
          i.status = 'open';
        } else {
          if (i.status !== 'open') throw new Error('Finding already decided');
          if (action === 'accept') {
            if (i.target === 'visual') throw new Error('Update the artwork and run a new audit.');
            if (r.text.slice(i.startIndex, i.endIndex) !== i.flaggedText)
              throw new Error('Stale text span. Re-audit the draft.');
            r.text = r.text.slice(0, i.startIndex) + i.suggestedRewrite + r.text.slice(i.endIndex);
            const delta = i.suggestedRewrite.length - (i.endIndex - i.startIndex);
            for (const other of r.issues)
              if (other.id !== i.id && other.target === 'text' && other.startIndex >= i.endIndex) {
                other.startIndex += delta;
                other.endIndex += delta;
              }
          }
          i.status = action === 'accept' ? 'accepted' : 'rejected';
        }
      }
    }
    r.version++;
    r.score = alignment(r.issues);
    r.events.push({
      id: id(),
      at: Date.now() / 1000,
      actor: `demo-${role}`,
      role,
      action: {
        accept: 'Accepted suggestion',
        reject: 'Rejected suggestion',
        reopen: 'Reopened finding',
        submit: 'Sent for manager approval',
        approve: 'Approved for publication',
        return: 'Changes requested',
      }[action],
      detail: comment || r.issues.find((i) => i.id === issueId)?.flaggedText || '',
      version: r.version,
    });
    save(s);
    return r;
  },
};

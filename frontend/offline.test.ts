import { describe, it, expect } from 'vitest';
import { aggregateInsights, alignment, analyzeLocal } from './offline';
import seed from './shared/guidelines.json';
import type { Guideline, Issue, Review } from './types';
const gs = seed as Guideline[];
describe('browser demo contract', () => {
  it('uses UTF-16 offsets after emoji and detects repeated terms', () => {
    const text = '🚀 users and users start at $29/month.';
    const issues = analyzeLocal(
      {
        title: 'Test',
        channel: 'Social',
        text,
        visual: { colors: [], logoPosition: '', image: '' },
      },
      gs,
    );
    expect(issues).toHaveLength(3);
    for (const i of issues) expect(text.slice(i.startIndex, i.endIndex)).toBe(i.flaggedText);
  });
  it('keeps rejected findings in the score', () => {
    const issues = analyzeLocal(
      {
        title: 'Test',
        channel: 'Social',
        text: 'revolutionary',
        visual: { colors: [], logoPosition: '', image: '' },
      },
      gs,
    );
    expect(alignment(issues)).toBe(93);
    issues[0].status = 'rejected';
    expect(alignment(issues)).toBe(93);
    issues[0].status = 'accepted';
    expect(alignment(issues)).toBe(100);
  });
  it('only evaluates active sources', () => {
    expect(
      analyzeLocal(
        {
          title: 'Test',
          channel: 'Social',
          text: 'revolutionary',
          visual: { colors: [], logoPosition: '', image: '' },
        },
        gs.map((g) => ({ ...g, active: false })),
      ),
    ).toEqual([]);
  });
  it('flags the highest supplied color-pair contrast below WCAG AA', () => {
    const issues = analyzeLocal(
      {
        title: 'Test',
        channel: 'Social',
        text: 'The card uses #8B5CF6 and #22D3EE.',
        visual: { colors: [], logoPosition: '', image: '' },
      },
      gs,
    );
    const contrast = issues.find((issue) => issue.ruleCategory === 'Accessibility');
    expect(contrast?.target).toBe('visual');
    expect(contrast?.ruleCitation).toBe('Section 5.1: Accessibility & Readability');
    expect(contrast?.explanation).toMatch(/\d+\.\d+:1 < 4\.5:1 WCAG AA/);
    expect(
      analyzeLocal(
        {
          title: 'Test',
          channel: 'Social',
          text: '',
          visual: { colors: ['#0C0D14', '#FFFFFF'], logoPosition: '', image: '' },
        },
        gs,
      ).some((issue) => issue.ruleCategory === 'Accessibility'),
    ).toBe(false);
  });
  it('flags non-inclusive language and ambiguous calls to action', () => {
    const issues = analyzeLocal(
      {
        title: 'Test',
        channel: 'Social',
        text: 'We found a blind spot. Click here.',
        visual: { colors: [], logoPosition: '', image: '' },
      },
      gs,
    );
    expect(issues.map((issue) => [issue.flaggedText, issue.suggestedRewrite])).toEqual([
      ['blind spot', 'overlooked gap'],
      ['Click here', 'view the full guide'],
    ]);
  });
  it('aggregates offline reviews into governance insights', () => {
    const makeReview = (
      status: Review['status'],
      score: number,
      issueStatus: Issue['status'],
      channel: string,
    ): Review => ({
      title: 'Test',
      channel,
      text: 'users',
      visual: { colors: [], logoPosition: '', image: '' },
      id: `${status}-${channel}`,
      original: 'users',
      originalVisual: { colors: [], logoPosition: '', image: '' },
      owner: 'demo-creator',
      createdAt: 1,
      version: 1,
      status,
      issues: [
        {
          id: 'issue',
          startIndex: 0,
          endIndex: 5,
          flaggedText: 'users',
          ruleCategory: 'Terminology',
          ruleCitation: 'Section 2.4',
          explanation: 'Use customers.',
          suggestedRewrite: 'customers',
          severity: 'low',
          target: 'text',
          status: issueStatus,
        },
      ],
      score,
      mode: 'browser demo',
      visualCoverage: 'no asset supplied',
      context: [],
      events: [],
      comment: '',
      policyHash: '',
    });
    const insights = aggregateInsights([
      makeReview('approved', 90, 'accepted', 'Social'),
      makeReview('returned', 70, 'rejected', 'Email'),
    ]);
    expect(insights).toMatchObject({
      totalReviews: 2,
      approvedCount: 1,
      returnedCount: 1,
      averageScore: 80,
      topViolations: [
        {
          ruleCitation: 'Section 2.4',
          flaggedText: 'users',
          count: 2,
          acceptedCount: 1,
          rejectedCount: 1,
          openCount: 0,
        },
      ],
      unclearGuidelines: [{ rejectionRate: 0.5, totalCount: 2, rejectedCount: 1 }],
      channelBreakdown: [
        { channel: 'Email', reviewCount: 1, averageScore: 70 },
        { channel: 'Social', reviewCount: 1, averageScore: 90 },
      ],
    });
  });
});

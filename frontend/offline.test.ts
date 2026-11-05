import { describe, it, expect } from 'vitest';
import { alignment, analyzeLocal } from './offline';
import seed from './shared/guidelines.json';
import type { Guideline } from './types';
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
});

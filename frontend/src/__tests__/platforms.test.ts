import { describe, it, expect } from 'vitest';
import { PLATFORM_LABELS, type Platform } from '@/lib/platforms';

describe('platforms', () => {
  it('has labels for all three platforms', () => {
    expect(PLATFORM_LABELS.xhs).toBe('小红书');
    expect(PLATFORM_LABELS.dy).toBe('抖音');
    expect(PLATFORM_LABELS.amazon).toBe('Amazon');
  });

  it('platform labels are non-empty strings', () => {
    for (const label of Object.values(PLATFORM_LABELS)) {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

import { describe, expect, it } from 'vitest';
import {
  clamp01,
  computeVerticalProgress,
  getProgress,
  restoreProgress,
  verticalScrollLeft,
} from '../../src/lib/reader/scrollProgress';

function scrollElement(values: {
  scrollLeft?: number;
  scrollTop?: number;
  scrollWidth?: number;
  clientWidth?: number;
  scrollHeight?: number;
  clientHeight?: number;
}): HTMLDivElement {
  const element = document.createElement('div');
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(element, key, {
      value,
      writable: true,
      configurable: true,
    });
  }
  return element;
}

describe('scroll progress', () => {
  it('PROG-NEG computes progress for negative scrollLeft conventions', () => {
    expect(computeVerticalProgress(0, 1000, 'neg')).toBe(0);
    expect(computeVerticalProgress(-500, 1000, 'neg')).toBe(0.5);
    expect(computeVerticalProgress(-1000, 1000, 'neg')).toBe(1);
    expect(computeVerticalProgress(-1500, 1000, 'neg')).toBe(1);
    expect(verticalScrollLeft(0.5, 1000, 'neg')).toBe(-500);
  });

  it('PROG-POS-INC computes progress when scrollLeft grows', () => {
    expect(computeVerticalProgress(0, 1000, 'pos-inc')).toBe(0);
    expect(computeVerticalProgress(250, 1000, 'pos-inc')).toBe(0.25);
    expect(computeVerticalProgress(1000, 1000, 'pos-inc')).toBe(1);
    expect(verticalScrollLeft(0.25, 1000, 'pos-inc')).toBe(250);
  });

  it('PROG-POS-DEC computes progress when scrollLeft shrinks', () => {
    expect(computeVerticalProgress(1000, 1000, 'pos-dec')).toBe(0);
    expect(computeVerticalProgress(250, 1000, 'pos-dec')).toBe(0.75);
    expect(computeVerticalProgress(0, 1000, 'pos-dec')).toBe(1);
    expect(verticalScrollLeft(0.25, 1000, 'pos-dec')).toBe(750);
  });

  it('PROG-HORIZONTAL uses scrollTop over the vertical scroll range', () => {
    const element = scrollElement({ scrollTop: 200, scrollHeight: 1000, clientHeight: 200 });
    expect(getProgress(element, 'horizontal')).toBe(0.25);

    const empty = scrollElement({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 });
    expect(getProgress(empty, 'horizontal')).toBe(0);
  });

  it('PROG-RESTORE writes the right scroll offset for both orientations', () => {
    const horizontal = scrollElement({ scrollTop: 0, scrollHeight: 1000, clientHeight: 200 });
    restoreProgress(horizontal, 'horizontal', 0.5);
    expect(horizontal.scrollTop).toBe(400);

    const vertical = scrollElement({
      scrollLeft: 0,
      scrollWidth: 1000,
      clientWidth: 100,
      scrollHeight: 500,
      clientHeight: 500,
    });
    Object.defineProperty(vertical, 'scrollLeft', {
      value: 1000,
      writable: true,
      configurable: true,
    });
    restoreProgress(vertical, 'vertical', 0.5);
    expect(vertical.scrollLeft).toBe(-450);
  });

  it('PROG-CLAMP clamps and guards non-finite ratios', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
    expect(computeVerticalProgress(0, 0, 'neg')).toBe(0);
    expect(verticalScrollLeft(2, 100, 'pos-inc')).toBe(100);
    expect(verticalScrollLeft(-2, 100, 'pos-inc')).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import {
  installVerticalWheel,
  readScrollRatio,
  resetScrollConvention,
  writeScrollRatio,
} from '../../src/lib/reader/readerScroll';

function verticalScroller(): HTMLDivElement {
  const element = document.createElement('div');
  let scrollLeft = 0;
  Object.defineProperty(element, 'scrollWidth', { value: 1000, configurable: true });
  Object.defineProperty(element, 'clientWidth', { value: 100, configurable: true });
  Object.defineProperty(element, 'scrollLeft', {
    configurable: true,
    get: () => scrollLeft,
    set: (value: number) => {
      scrollLeft = value;
    },
  });
  return element;
}

describe('vertical wheel controller', () => {
  it('RATIO-WRAPPERS read and write both orientations', () => {
    const vertical = verticalScroller();
    expect(readScrollRatio(vertical, 'vertical')).toBe(0);
    vertical.scrollLeft = -450;
    expect(readScrollRatio(vertical, 'vertical')).toBeCloseTo(0.5, 5);
    writeScrollRatio(vertical, 'vertical', 1);
    expect(vertical.scrollLeft).toBe(-900);
    resetScrollConvention(vertical);

    const horizontal = document.createElement('div');
    Object.defineProperty(horizontal, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(horizontal, 'clientHeight', { value: 200, configurable: true });
    let scrollTop = 0;
    Object.defineProperty(horizontal, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    expect(readScrollRatio(horizontal, 'horizontal')).toBe(0);
    writeScrollRatio(horizontal, 'horizontal', 0.5);
    expect(horizontal.scrollTop).toBe(400);
    expect(readScrollRatio(horizontal, 'horizontal')).toBeCloseTo(0.5, 5);
  });

  it('WHEEL-ZOOM leaves Ctrl/Meta wheel events untouched', () => {
    const element = verticalScroller();
    const cleanup = installVerticalWheel(element);

    const ctrl = new WheelEvent('wheel', { deltaY: 120, ctrlKey: true, cancelable: true });
    element.dispatchEvent(ctrl);
    expect(ctrl.defaultPrevented).toBe(false);
    expect(element.scrollLeft).toBe(0);

    const meta = new WheelEvent('wheel', { deltaY: 120, metaKey: true, cancelable: true });
    element.dispatchEvent(meta);
    expect(meta.defaultPrevented).toBe(false);
    expect(element.scrollLeft).toBe(0);

    const normal = new WheelEvent('wheel', { deltaY: 120, cancelable: true });
    element.dispatchEvent(normal);
    expect(normal.defaultPrevented).toBe(true);
    expect(element.scrollLeft).not.toBe(0);

    cleanup();
  });
});

import {
  clamp01,
  computeVerticalProgress,
  detectVerticalConvention,
  verticalScrollLeft,
  type ScrollConvention,
} from './scrollProgress';
import type { Orientation } from '../types';

// Probing scrollLeft is a layout read. It happens once per element and the result
// is cached because engines disagree on the sign/direction of vertical-rl overflow.
const conventions = new WeakMap<HTMLElement, ScrollConvention>();

export function scrollConvention(element: HTMLElement): ScrollConvention {
  const cached = conventions.get(element);
  if (cached !== undefined) return cached;
  const detected = detectVerticalConvention(element);
  conventions.set(element, detected);
  return detected;
}

export function resetScrollConvention(element: HTMLElement): void {
  conventions.delete(element);
}

export function readScrollRatio(element: HTMLElement, orientation: Orientation): number {
  if (orientation === 'horizontal') {
    const max = element.scrollHeight - element.clientHeight;
    if (max <= 0) return 0;
    return clamp01(element.scrollTop / max);
  }
  const max = element.scrollWidth - element.clientWidth;
  if (max <= 0) return 0;
  return computeVerticalProgress(element.scrollLeft, max, scrollConvention(element));
}

export function writeScrollRatio(
  element: HTMLElement,
  orientation: Orientation,
  ratio: number,
): void {
  if (orientation === 'horizontal') {
    const max = element.scrollHeight - element.clientHeight;
    element.scrollTop = clamp01(ratio) * Math.max(0, max);
    return;
  }
  const max = element.scrollWidth - element.clientWidth;
  element.scrollLeft = verticalScrollLeft(ratio, max, scrollConvention(element));
}

export function installVerticalWheel(element: HTMLElement): () => void {
  const handler = (event: WheelEvent): void => {
    // Leave Ctrl/Cmd+wheel to the browser so pinch/wheel zoom is never hijacked.
    if (event.ctrlKey || event.metaKey) return;
    if (element.scrollWidth <= element.clientWidth) return;
    const delta = event.shiftKey ? event.deltaX || event.deltaY : event.deltaY;
    if (delta === 0) return;

    const max = element.scrollWidth - element.clientWidth;
    const convention = scrollConvention(element);
    const ratio = computeVerticalProgress(element.scrollLeft, max, convention);
    const next = clamp01(ratio + (delta * 1.4) / max);
    element.scrollLeft = verticalScrollLeft(next, max, convention);
    event.preventDefault();
  };

  element.addEventListener('wheel', handler, { passive: false });
  return () => element.removeEventListener('wheel', handler);
}

export type ScrollConvention = 'neg' | 'pos-inc' | 'pos-dec' | 'none';
export type Orientation = 'horizontal' | 'vertical';

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function computeVerticalProgress(
  scrollLeft: number,
  max: number,
  convention: ScrollConvention,
): number {
  if (max <= 0 || !Number.isFinite(max)) return 0;
  switch (convention) {
    case 'neg':
      return clamp01(-scrollLeft / max);
    case 'pos-inc':
      return clamp01(scrollLeft / max);
    case 'pos-dec':
      return clamp01((max - scrollLeft) / max);
    case 'none':
      return 0;
  }
}

export function verticalScrollLeft(
  ratio: number,
  max: number,
  convention: ScrollConvention,
): number {
  if (max <= 0 || !Number.isFinite(max)) return 0;
  const clamped = clamp01(ratio);
  switch (convention) {
    case 'neg':
      return -clamped * max;
    case 'pos-inc':
      return clamped * max;
    case 'pos-dec':
      return max - clamped * max;
    case 'none':
      return 0;
  }
}

export function detectVerticalConvention(element: HTMLElement): ScrollConvention {
  const max = element.scrollWidth - element.clientWidth;
  if (max <= 0) return 'none';

  const previous = element.scrollLeft;
  element.scrollLeft = -1;
  const probed = element.scrollLeft;
  element.scrollLeft = previous;

  if (probed < 0) return 'neg';
  return getComputedStyle(element).direction === 'rtl' ? 'pos-dec' : 'pos-inc';
}

export function getProgress(element: HTMLElement, orientation: Orientation): number {
  if (orientation === 'horizontal') {
    const max = element.scrollHeight - element.clientHeight;
    if (max <= 0) return 0;
    return clamp01(element.scrollTop / max);
  }

  const max = element.scrollWidth - element.clientWidth;
  if (max <= 0) return 0;
  return computeVerticalProgress(
    element.scrollLeft,
    max,
    detectVerticalConvention(element),
  );
}

export function restoreProgress(
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
  element.scrollLeft = verticalScrollLeft(ratio, max, detectVerticalConvention(element));
}

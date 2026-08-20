export type ContextMenuPlacement = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface ContextMenuPosition {
  left: number;
  top: number;
  placement: ContextMenuPlacement;
}

export interface ContextMenuPositionOptions {
  clickX: number;
  clickY: number;
  menuWidth: number;
  menuHeight: number;
  viewportLeft?: number;
  viewportTop?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  margin?: number;
  anchorGap?: number;
}

export const getAdaptiveContextMenuPosition = ({
  clickX,
  clickY,
  menuWidth,
  menuHeight,
  viewportLeft = 0,
  viewportTop = 0,
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024,
  viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768,
  margin = 8,
  anchorGap = 8,
}: ContextMenuPositionOptions): ContextMenuPosition => {
  const safeX = Number.isFinite(clickX) ? clickX : margin;
  const safeY = Number.isFinite(clickY) ? clickY : margin;
  const safeWidth = Math.max(1, menuWidth);
  const safeHeight = Math.max(1, menuHeight);
  const minLeft = viewportLeft + margin;
  const minTop = viewportTop + margin;
  const maxLeft = Math.max(minLeft, viewportLeft + viewportWidth - safeWidth - margin);
  const maxTop = Math.max(minTop, viewportTop + viewportHeight - safeHeight - margin);
  const fitsRight = safeX + anchorGap + safeWidth <= viewportLeft + viewportWidth - margin;
  const fitsLeft = safeX - anchorGap - safeWidth >= minLeft;
  const fitsBelow = safeY + anchorGap + safeHeight <= viewportTop + viewportHeight - margin;
  const fitsAbove = safeY - anchorGap - safeHeight >= minTop;
  const horizontal: 'left' | 'right' = fitsRight || !fitsLeft ? 'right' : 'left';
  const vertical: 'top' | 'bottom' = fitsBelow || !fitsAbove ? 'bottom' : 'top';
  const rawLeft = horizontal === 'right' ? safeX + anchorGap : safeX - safeWidth - anchorGap;
  const rawTop = vertical === 'bottom' ? safeY + anchorGap : safeY - safeHeight - anchorGap;

  return {
    left: Math.max(minLeft, Math.min(rawLeft, maxLeft)),
    top: Math.max(minTop, Math.min(rawTop, maxTop)),
    placement: `${vertical}-${horizontal}`,
  };
};

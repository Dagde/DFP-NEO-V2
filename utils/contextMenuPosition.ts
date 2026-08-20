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
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024,
  viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768,
  margin = 8,
  anchorGap = 8,
}: ContextMenuPositionOptions): ContextMenuPosition => {
  const safeX = Number.isFinite(clickX) ? clickX : margin;
  const safeY = Number.isFinite(clickY) ? clickY : margin;
  const safeWidth = Math.max(1, menuWidth);
  const safeHeight = Math.max(1, menuHeight);
  const maxLeft = Math.max(margin, viewportWidth - safeWidth - margin);
  const maxTop = Math.max(margin, viewportHeight - safeHeight - margin);
  const fitsRight = safeX + anchorGap + safeWidth <= viewportWidth - margin;
  const fitsLeft = safeX - anchorGap - safeWidth >= margin;
  const fitsBelow = safeY + anchorGap + safeHeight <= viewportHeight - margin;
  const fitsAbove = safeY - anchorGap - safeHeight >= margin;
  const horizontal: 'left' | 'right' = fitsRight || !fitsLeft ? 'right' : 'left';
  const vertical: 'top' | 'bottom' = fitsBelow || !fitsAbove ? 'bottom' : 'top';
  const rawLeft = horizontal === 'right' ? safeX + anchorGap : safeX - safeWidth - anchorGap;
  const rawTop = vertical === 'bottom' ? safeY + anchorGap : safeY - safeHeight - anchorGap;

  return {
    left: Math.max(margin, Math.min(rawLeft, maxLeft)),
    top: Math.max(margin, Math.min(rawTop, maxTop)),
    placement: `${vertical}-${horizontal}`,
  };
};

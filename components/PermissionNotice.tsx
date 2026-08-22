import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface PermissionNoticeProps {
  anchorRect: DOMRect | null;
  message?: string;
  durationMs?: number;
  onClose: () => void;
}

const VIEWPORT_GAP = 8;
const ANCHOR_GAP = 8;

const PermissionNotice: React.FC<PermissionNoticeProps> = ({
  anchorRect,
  message = 'Permissions: Not Allowed',
  durationMs = 5000,
  onClose,
}) => {
  const noticeRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchorRect) return;

    const updatePosition = () => {
      const notice = noticeRef.current;
      if (!notice) return;

      const noticeRect = notice.getBoundingClientRect();
      const desiredLeft = anchorRect.left + (anchorRect.width / 2) - (noticeRect.width / 2);
      const left = Math.min(
        Math.max(desiredLeft, VIEWPORT_GAP),
        Math.max(VIEWPORT_GAP, window.innerWidth - noticeRect.width - VIEWPORT_GAP),
      );
      const aboveTop = anchorRect.top - noticeRect.height - ANCHOR_GAP;
      const belowTop = anchorRect.bottom + ANCHOR_GAP;
      const top = aboveTop >= VIEWPORT_GAP
        ? aboveTop
        : Math.min(
          belowTop,
          Math.max(VIEWPORT_GAP, window.innerHeight - noticeRect.height - VIEWPORT_GAP),
        );

      setPosition({ left, top });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRect]);

  useEffect(() => {
    const timer = window.setTimeout(onClose, durationMs);
    const closeOnNextInteraction = () => onClose();
    window.addEventListener('pointerdown', closeOnNextInteraction);
    window.addEventListener('keydown', closeOnNextInteraction);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', closeOnNextInteraction);
      window.removeEventListener('keydown', closeOnNextInteraction);
    };
  }, [durationMs, onClose]);

  if (!anchorRect) return null;

  return (
    <div
      ref={noticeRef}
      className="pointer-events-none fixed z-[250] whitespace-nowrap rounded-md border border-red-400/40 bg-slate-950 px-2.5 py-1 text-[10px] font-bold text-red-200 shadow-lg"
      style={{
        left: position?.left ?? -9999,
        top: position?.top ?? -9999,
      }}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
};

export default PermissionNotice;

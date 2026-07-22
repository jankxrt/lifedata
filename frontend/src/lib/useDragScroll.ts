import { useRef, useCallback } from 'react';

const INTERACTIVE = new Set(['button', 'a', 'select', 'input', 'textarea', 'label']);

export function useDragScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const state = useRef({ active: false, moved: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (INTERACTIVE.has((e.target as HTMLElement).tagName.toLowerCase())) return;
    const el = ref.current;
    if (!el) return;
    state.current = { active: true, moved: false, startX: e.clientX, startY: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
    el.style.cursor = 'grabbing';
    el.style.userSelect = 'none';
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const s = state.current;
    if (!s.active || !ref.current) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
    s.moved = true;
    e.preventDefault();
    ref.current.scrollLeft = s.scrollLeft - dx;
    ref.current.scrollTop  = s.scrollTop  - dy;
  }, []);

  const onMouseUp = useCallback(() => {
    state.current.active = false;
    if (ref.current) { ref.current.style.cursor = ''; ref.current.style.userSelect = ''; }
  }, []);

  const onMouseLeave = useCallback(() => {
    state.current.active = false;
    if (ref.current) { ref.current.style.cursor = ''; ref.current.style.userSelect = ''; }
  }, []);

  return { ref, onMouseDown, onMouseMove, onMouseUp, onMouseLeave };
}

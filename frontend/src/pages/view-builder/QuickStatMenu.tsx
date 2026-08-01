import { useEffect, useRef } from 'react';
import { QUICK_STAT_LABELS, type QuickStatKind } from '../../api/types';

export interface QuickStatMenuPosition {
  x: number;
  y: number;
}

/** Right-click context menu offering the one-click quick stats for a numeric field already on a shelf. */
export function QuickStatMenu({
  position,
  onSelect,
  onClose,
}: {
  position: QuickStatMenuPosition;
  onSelect: (kind: QuickStatKind) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [onClose]);

  return (
    <ul ref={ref} className="quick-stat-menu" role="menu" style={{ top: position.y, left: position.x }}>
      {(Object.keys(QUICK_STAT_LABELS) as QuickStatKind[]).map((kind) => (
        <li key={kind} role="menuitem">
          <button type="button" onClick={() => onSelect(kind)}>
            {QUICK_STAT_LABELS[kind]}
          </button>
        </li>
      ))}
    </ul>
  );
}

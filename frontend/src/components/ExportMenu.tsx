import { useEffect, useRef, useState } from 'react';

/** A single "Exporter ▾" button that reveals Excel/PDF as a dropdown, instead of two separate buttons. */
export function ExportMenu({ onExport, disabled }: { onExport: (format: 'excel' | 'pdf') => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  function handleSelect(format: 'excel' | 'pdf') {
    setOpen(false);
    onExport(format);
  }

  return (
    <div ref={ref} className="export-menu">
      <button type="button" className="secondary" disabled={disabled} onClick={() => setOpen((prev) => !prev)} aria-haspopup="menu" aria-expanded={open}>
        Exporter ▾
      </button>
      {open && (
        <ul className="export-menu-dropdown" role="menu">
          <li role="menuitem">
            <button type="button" onClick={() => handleSelect('excel')}>
              Excel
            </button>
          </li>
          <li role="menuitem">
            <button type="button" onClick={() => handleSelect('pdf')}>
              PDF
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

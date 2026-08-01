import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

/** In-app modal confirmation — used instead of the browser's native confirm()/prompt() so destructive actions stay visually consistent with the rest of the app. */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmer', tone = 'default', onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="confirm-dialog" onCancel={onCancel}>
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="page-actions">
        <button type="button" className="secondary" onClick={onCancel}>
          Annuler
        </button>
        <button type="button" className={tone === 'danger' ? 'danger' : undefined} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

import { useState } from 'react';
import type { Group, ViewVisibility } from '../api/types';

/**
 * Share/unshare with a group — lives on a view or dashboard's own detail page, not in the list
 * row it's shown in: sharing is a deliberate, occasional configuration action, not something a
 * scannable list of items should have to make room for on every single row.
 */
export function ShareControl({
  idPrefix,
  itemName,
  visibility,
  sharedWithGroupId,
  groups,
  onShare,
  onUnshare,
}: {
  idPrefix: string;
  itemName: string;
  visibility: ViewVisibility;
  sharedWithGroupId: string | null;
  groups: Group[];
  onShare: (groupId: string) => Promise<void>;
  onUnshare: () => Promise<void>;
}) {
  const [selectedGroupId, setSelectedGroupId] = useState(sharedWithGroupId ?? '');
  const [busy, setBusy] = useState(false);

  async function handleShare() {
    if (!selectedGroupId) return;
    setBusy(true);
    try {
      await onShare(selectedGroupId);
    } finally {
      setBusy(false);
    }
  }

  async function handleUnshare() {
    setBusy(true);
    try {
      await onUnshare();
      setSelectedGroupId('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="share-control">
      <label htmlFor={`${idPrefix}-share-group`} className="visually-hidden">
        Partager {itemName} avec un groupe
      </label>
      <select id={`${idPrefix}-share-group`} value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}>
        <option value="">Choisir un groupe…</option>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
      <button type="button" onClick={handleShare} disabled={busy || !selectedGroupId || selectedGroupId === sharedWithGroupId}>
        {visibility === 'shared' ? 'Changer' : 'Partager'}
      </button>
      {visibility === 'shared' && (
        <button type="button" className="secondary" onClick={handleUnshare} disabled={busy}>
          Ne plus partager
        </button>
      )}
    </div>
  );
}

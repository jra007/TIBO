/** One row of a settings page: label + description on the left, the actual control on the right — shared across every settings page (Apparence, Rapport, ...) instead of each inventing its own card layout. */
export function SettingsRow({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="settings-row">
      <div className="settings-row-info">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

const STATUS_STYLES = {
  good: { color: 'var(--good)', background: 'var(--good-bg)' },
  warning: { color: 'var(--warning)', background: 'var(--warning-bg)' },
  critical: { color: 'var(--critical)', background: 'var(--critical-bg)' },
} as const;

export type StatusTone = keyof typeof STATUS_STYLES;

/** Status is always carried by the label text too — color is supplementary, never the only signal. */
export function StatusBadge({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return (
    <span
      style={{
        ...STATUS_STYLES[tone],
        display: 'inline-block',
        borderRadius: 999,
        padding: '2px 10px',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

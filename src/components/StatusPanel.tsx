type StatusPanelProps = {
  label: string;
  tone?: "default" | "success" | "warning";
  value: string;
};

export function StatusPanel({ label, tone = "default", value }: StatusPanelProps) {
  return (
    <article className={`status-panel status-panel-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

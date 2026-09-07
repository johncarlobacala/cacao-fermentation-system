export function StatCard({
  label,
  value,
  color = "blue",
}: {
  label: string;
  value: string | number;
  color?: "blue" | "green" | "amber" | "red";
}) {
  return (
    <div className="card">
      <div className="stat-card-label">{label}</div>
      <div className={`stat-card-value stat-${color}`}>{value}</div>
    </div>
  );
  
}

export function SimpleBarChart({
  bars,
  color = "#6c4ff6",
  total,
}: {
  bars: {
    label: string;
    value: number;
    displayValue?: string;
  }[];
  color?: string;
  total: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {bars.map((b) => {
        // Total batches = 100%
        const percentage =
          total > 0 ? Math.min((b.value / total) * 100, 100) : 0;

        return (
          <div key={b.label}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 13,
                marginBottom: 5,
              }}
            >
              <span style={{ fontWeight: 600 }}>
                {b.label}
              </span>

              <span
                style={{
                  color: "var(--color-text-muted)",
                }}
              >
                {b.displayValue ?? b.value}
              </span>
            </div>

            {/* 100% track */}
            <div
              style={{
                background: "var(--color-bg)",
                borderRadius: 8,
                height: 10,
                overflow: "hidden",
                width: "100%",
              }}
            >
              {/* Actual value */}
              <div
                style={{
                  width: `${percentage}%`,
                  background: color,
                  height: "100%",
                  borderRadius: 8,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        );
      })}

      {bars.length === 0 && (
        <div
          style={{
            color: "var(--color-text-muted)",
            fontSize: 13.5,
          }}
        >
          No data yet.
        </div>
      )}
    </div>
  );
}
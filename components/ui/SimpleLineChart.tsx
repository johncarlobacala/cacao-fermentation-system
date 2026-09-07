"use client";

export function SimpleLineChart({
  points,
  height = 220,
  minY,
  maxY,
  color = "#6c4ff6",
}: {
  points: { label: string; value: number }[];
  height?: number;
  minY?: number;
  maxY?: number;
  color?: string;
}) {
  if (!points.length) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-muted)",
          fontSize: 14,
        }}
      >
        No readings yet.
      </div>
    );
  }

  const width = 700;
  const padding = 30;
  const values = points.map((p) => p.value);
  const yMin = minY ?? Math.min(...values) - 1;
  const yMax = maxY ?? Math.max(...values) + 1;

  const xStep = (width - padding * 2) / Math.max(points.length - 1, 1);

  const coords = points.map((p, i) => {
    const x = padding + i * xStep;
    const y =
      height - padding - ((p.value - yMin) / (yMax - yMin || 1)) * (height - padding * 2);
    return { x, y, ...p };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1].x},${height - padding} L${
    coords[0].x
  },${height - padding} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <defs>
        <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#lineFill)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={3} fill={color} />
      ))}
    </svg>
  );
}

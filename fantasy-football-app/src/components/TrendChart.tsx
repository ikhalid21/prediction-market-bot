import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { SERIES_ORDER } from "../lib/format";

export interface TrendSeries {
  key: string;
  label: string;
  color?: string;
}

export default function TrendChart({
  data,
  series,
  xKey,
  height = 260,
  yLabel,
}: {
  data: Record<string, unknown>[];
  series: TrendSeries[];
  xKey: string;
  height?: number;
  yLabel?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          stroke="var(--border-strong)"
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          stroke="var(--border-strong)"
          tickLine={false}
          axisLine={false}
          width={36}
          label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft", fontSize: 11, fill: "var(--text-muted)" } : undefined}
        />
        <Tooltip
          contentStyle={{
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--text-primary)",
          }}
          labelStyle={{ color: "var(--text-secondary)", fontWeight: 600, marginBottom: 4 }}
        />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />}
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? SERIES_ORDER[i % SERIES_ORDER.length]}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: s.color ?? SERIES_ORDER[i % SERIES_ORDER.length] }}
            activeDot={{ r: 5 }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

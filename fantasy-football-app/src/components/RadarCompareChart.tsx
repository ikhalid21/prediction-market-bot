import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { SERIES_ORDER } from "../lib/format";

export interface RadarEntity {
  key: string;
  label: string;
}

export default function RadarCompareChart({
  data,
  entities,
  height = 320,
}: {
  data: Record<string, unknown>[];
  entities: RadarEntity[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} />
        <PolarRadiusAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickCount={4} />
        <Tooltip
          contentStyle={{
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--text-primary)",
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
        {entities.map((e, i) => {
          const color = SERIES_ORDER[i % SERIES_ORDER.length];
          return (
            <Radar
              key={e.key}
              name={e.label}
              dataKey={e.key}
              stroke={color}
              fill={color}
              fillOpacity={0.15}
              strokeWidth={2}
              isAnimationActive={false}
            />
          );
        })}
      </RadarChart>
    </ResponsiveContainer>
  );
}

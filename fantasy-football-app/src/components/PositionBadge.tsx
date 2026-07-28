import type { Position } from "../lib/types";
import { POSITION_COLORS } from "../lib/format";

export default function PositionBadge({ position, size = "sm" }: { position: Position; size?: "sm" | "md" }) {
  const color = POSITION_COLORS[position];
  return (
    <span
      className={`inline-flex items-center justify-center rounded font-semibold shrink-0 ${
        size === "sm" ? "text-[11px] px-1.5 py-0.5 min-w-[30px]" : "text-xs px-2 py-1 min-w-[38px]"
      }`}
      style={{ backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
    >
      {position}
    </span>
  );
}

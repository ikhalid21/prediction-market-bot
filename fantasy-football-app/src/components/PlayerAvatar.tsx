import { useState } from "react";
import type { Position } from "../lib/types";
import { POSITION_COLORS } from "../lib/format";

export default function PlayerAvatar({
  src,
  name,
  position,
  size = 40,
}: {
  src?: string | null;
  name: string;
  position: Position;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");
  const color = POSITION_COLORS[position];

  if (!src || failed) {
    return (
      <div
        className="rounded-full flex items-center justify-center font-semibold shrink-0"
        style={{
          width: size,
          height: size,
          backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`,
          color,
          fontSize: size * 0.36,
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="rounded-full object-cover shrink-0 bg-[var(--surface-3)]"
      style={{ width: size, height: size }}
    />
  );
}

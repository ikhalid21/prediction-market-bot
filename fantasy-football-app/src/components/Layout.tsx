import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import { useScoring } from "../lib/ScoringContext";
import type { ScoringFormat } from "../lib/types";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/players", label: "Players" },
  { to: "/compare", label: "Compare" },
  { to: "/schedule", label: "Schedule Difficulty" },
  { to: "/draft", label: "Mock Draft" },
  { to: "/historical", label: "Historical" },
];

function ScoringSwitcher() {
  const { format, setFormat } = useScoring();
  const opts: { v: ScoringFormat; label: string }[] = [
    { v: "standard", label: "Std" },
    { v: "half", label: "Half" },
    { v: "ppr", label: "PPR" },
  ];
  return (
    <div className="flex rounded-lg border border-[var(--border)] p-0.5 bg-[var(--surface-1)]">
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => setFormat(o.v)}
          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
            format === o.v ? "brand-gradient text-white shadow-sm" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-2)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface-1)]/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <NavLink to="/" className="flex items-center gap-2 shrink-0 font-bold text-[15px] tracking-tight">
              <span className="w-7 h-7 rounded-lg brand-gradient flex items-center justify-center text-white text-[13px] font-bold shadow-[0_2px_10px_-2px_color-mix(in_oklab,var(--series-1)_60%,transparent)]">
                FF
              </span>
              <span className="hidden sm:inline">Gridiron Lab</span>
            </NavLink>
            <nav className="hidden lg:flex items-center gap-1">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[var(--surface-3)] text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]"
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ScoringSwitcher />
            <button
              className="lg:hidden p-2 rounded-md hover:bg-[var(--surface-3)]"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="lg:hidden border-t border-[var(--border)] px-4 py-2 flex flex-col gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm font-medium ${
                    isActive ? "bg-[var(--surface-3)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-[var(--border)] py-6 px-4 sm:px-6 text-center text-xs text-[var(--text-muted)]">
        Stats from nflverse (public NFL play-by-play data). Historical stats through the {" "}
        {2025} season; schedule &amp; matchups for the {2026} season. Draft rankings are our own Half-PPR Top-300
        projections for {2026}, built from multi-year trends and aging curves — not a live industry ADP feed.
      </footer>
    </div>
  );
}

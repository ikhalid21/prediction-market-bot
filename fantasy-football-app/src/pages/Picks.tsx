import { useEffect, useMemo, useRef, useState } from "react";
import { getTeams } from "../lib/data";
import type { TeamInfo } from "../lib/types";
import {
  PERSONS,
  DIVISIONS,
  AWARD_FIELDS,
  loadStore,
  saveStore,
  divisionTeams,
  conferenceTeams,
  type Person,
  type PicksStore,
  type NflPicks,
  type DivisionKey,
} from "../lib/picks";
import Loading from "../components/Loading";

const SEASON = 2026;
const TOTAL_FIELDS = DIVISIONS.length + 2 + 1 + AWARD_FIELDS.length; // divisions + conf champs + SB + awards

function filledCount(p: NflPicks): number {
  let n = 0;
  for (const d of DIVISIONS) if (p.divisions[d]) n++;
  if (p.afcChampion) n++;
  if (p.nfcChampion) n++;
  if (p.superBowlChampion) n++;
  if (p.mvp) n++;
  if (p.offensivePlayerOfYear) n++;
  if (p.defensivePlayerOfYear) n++;
  if (p.rookieOfYear) n++;
  return n;
}

function TeamSelect({
  teams,
  value,
  onChange,
  disabled,
  placeholder = "Select team…",
}: {
  teams: TeamInfo[];
  value: string;
  onChange: (abbr: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] text-sm disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <option value="">{placeholder}</option>
      {teams.map((t) => (
        <option key={t.abbr} value={t.abbr}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

export default function Picks() {
  const [teams, setTeams] = useState<TeamInfo[] | null>(null);
  const [store, setStore] = useState<PicksStore | null>(null);
  const [active, setActive] = useState<Person>(PERSONS[0]);
  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimer = useRef<number | null>(null);

  useEffect(() => {
    getTeams().then(setTeams);
    setStore(loadStore());
  }, []);

  useEffect(() => {
    if (!store) return;
    saveStore(store);
    setSavedFlash(true);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setSavedFlash(false), 1200);
    return () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    };
  }, [store]);

  const teamMap = useMemo(() => new Map((teams ?? []).map((t) => [t.abbr, t])), [teams]);

  function update(person: Person, patch: Partial<NflPicks>) {
    setStore((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [person]: { ...prev[person], ...patch, updatedAt: new Date().toISOString() },
      };
    });
  }

  function updateDivision(person: Person, division: DivisionKey, abbr: string) {
    setStore((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [person]: {
          ...prev[person],
          divisions: { ...prev[person].divisions, [division]: abbr },
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }

  function resetPerson(person: Person) {
    if (!window.confirm(`Clear all picks for ${person}?`)) return;
    setStore((prev) => {
      if (!prev) return prev;
      const cleared: NflPicks = {
        divisions: DIVISIONS.reduce((acc, d) => {
          acc[d] = "";
          return acc;
        }, {} as Record<DivisionKey, string>),
        afcChampion: "",
        nfcChampion: "",
        superBowlChampion: "",
        mvp: "",
        offensivePlayerOfYear: "",
        defensivePlayerOfYear: "",
        rookieOfYear: "",
        updatedAt: new Date().toISOString(),
      };
      return { ...prev, [person]: cleared };
    });
  }

  function exportPicks() {
    if (!store) return;
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nfl-picks-${SEASON}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importPicks(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        setStore((prev) => {
          if (!prev) return prev;
          const next = { ...prev };
          for (const person of PERSONS) {
            if (parsed[person]) {
              next[person] = {
                ...next[person],
                ...parsed[person],
                divisions: { ...next[person].divisions, ...(parsed[person].divisions ?? {}) },
              };
            }
          }
          return next;
        });
      } catch {
        window.alert("That file doesn't look like a valid picks export.");
      }
    };
    reader.readAsText(file);
  }

  if (!teams || !store) return <Loading label="Loading teams…" />;

  const picks = store[active];
  const afcTeams = conferenceTeams(teams, "AFC");
  const nfcTeams = conferenceTeams(teams, "NFC");
  const sbCandidates = [picks.afcChampion, picks.nfcChampion]
    .filter(Boolean)
    .map((abbr) => teamMap.get(abbr))
    .filter((t): t is TeamInfo => !!t);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{SEASON} Season Predictions</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Division winners, conference champions, the Super Bowl, and the major awards — Isa, Shahe, and Charlie
          each lock in their own picks below.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PERSONS.map((p) => {
          const count = filledCount(store[p]);
          const isActive = p === active;
          return (
            <button
              key={p}
              onClick={() => setActive(p)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                isActive
                  ? "brand-gradient text-white border-transparent"
                  : "border-[var(--border)] bg-[var(--surface-1)] hover:bg-[var(--surface-3)]"
              }`}
            >
              {p}
              <span className={`ml-2 text-xs font-normal ${isActive ? "text-white/80" : "text-[var(--text-muted)]"}`}>
                {count}/{TOTAL_FIELDS}
              </span>
            </button>
          );
        })}
        <span className={`text-xs text-[var(--good)] transition-opacity ${savedFlash ? "opacity-100" : "opacity-0"}`}>
          Saved ✓
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={exportPicks}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-3)]"
          >
            Export all picks
          </button>
          <label className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-3)] cursor-pointer">
            Import
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importPicks(f);
                e.target.value = "";
              }}
            />
          </label>
          <button
            onClick={() => resetPerson(active)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-3)] text-[var(--critical)]"
          >
            Reset {active}
          </button>
        </div>
      </div>

      <p className="text-xs text-[var(--text-muted)] -mt-3">
        Picks are saved to this browser only. Use Export to save a copy or share picks made on another device, and
        Import to merge them in.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="card p-5 flex flex-col gap-4">
          <h2 className="font-semibold text-[15px]">AFC Division Winners</h2>
          {DIVISIONS.filter((d) => d.startsWith("AFC")).map((d) => (
            <div key={d} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--text-secondary)]">{d}</label>
              <TeamSelect teams={divisionTeams(teams, d)} value={picks.divisions[d]} onChange={(abbr) => updateDivision(active, d, abbr)} />
            </div>
          ))}
        </section>

        <section className="card p-5 flex flex-col gap-4">
          <h2 className="font-semibold text-[15px]">NFC Division Winners</h2>
          {DIVISIONS.filter((d) => d.startsWith("NFC")).map((d) => (
            <div key={d} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--text-secondary)]">{d}</label>
              <TeamSelect teams={divisionTeams(teams, d)} value={picks.divisions[d]} onChange={(abbr) => updateDivision(active, d, abbr)} />
            </div>
          ))}
        </section>

        <section className="card p-5 flex flex-col gap-4">
          <h2 className="font-semibold text-[15px]">Conference Champions</h2>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--text-secondary)]">AFC Champion</label>
            <TeamSelect teams={afcTeams} value={picks.afcChampion} onChange={(abbr) => update(active, { afcChampion: abbr })} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--text-secondary)]">NFC Champion</label>
            <TeamSelect teams={nfcTeams} value={picks.nfcChampion} onChange={(abbr) => update(active, { nfcChampion: abbr })} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Super Bowl {SEASON + 1} Champion</label>
            {sbCandidates.length === 2 ? (
              <TeamSelect teams={sbCandidates} value={picks.superBowlChampion} onChange={(abbr) => update(active, { superBowlChampion: abbr })} />
            ) : (
              <div className="text-xs text-[var(--text-muted)] px-2.5 py-2 rounded-lg border border-dashed border-[var(--border)]">
                Pick both conference champions first
              </div>
            )}
          </div>
        </section>

        <section className="card p-5 flex flex-col gap-4">
          <h2 className="font-semibold text-[15px]">Awards</h2>
          {AWARD_FIELDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--text-secondary)]">{f.label}</label>
              <input
                value={picks[f.key]}
                onChange={(e) => update(active, { [f.key]: e.target.value } as Partial<NflPicks>)}
                placeholder={f.placeholder}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] text-sm"
              />
            </div>
          ))}
        </section>
      </div>

      <ComparisonTable store={store} teamMap={teamMap} />
    </div>
  );
}

function ComparisonTable({ store, teamMap }: { store: PicksStore; teamMap: Map<string, TeamInfo> }) {
  const rows: { label: string; get: (p: NflPicks) => string }[] = [
    ...DIVISIONS.map((d) => ({ label: d, get: (p: NflPicks) => p.divisions[d] })),
    { label: "AFC Champion", get: (p: NflPicks) => p.afcChampion },
    { label: "NFC Champion", get: (p: NflPicks) => p.nfcChampion },
    { label: "Super Bowl Champion", get: (p: NflPicks) => p.superBowlChampion },
    { label: "MVP", get: (p: NflPicks) => p.mvp },
    { label: "Offensive Player of the Year", get: (p: NflPicks) => p.offensivePlayerOfYear },
    { label: "Defensive Player of the Year", get: (p: NflPicks) => p.defensivePlayerOfYear },
    { label: "Rookie of the Year", get: (p: NflPicks) => p.rookieOfYear },
  ];

  function display(label: string, raw: string): string {
    if (!raw) return "—";
    if (label.includes("Award") || ["MVP", "Offensive Player of the Year", "Defensive Player of the Year", "Rookie of the Year"].includes(label)) {
      return raw;
    }
    return teamMap.get(raw)?.name ?? raw;
  }

  return (
    <section className="card overflow-hidden">
      <div className="p-4 border-b border-[var(--border)] flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-[15px]">All Picks Side by Side</h2>
        <span className="text-xs text-[var(--text-muted)]">Highlighted cells show where two or more agree</span>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-[var(--text-muted)] text-xs uppercase border-b border-[var(--border)]">
              <th className="py-2 pl-4 pr-2">Category</th>
              {PERSONS.map((p) => (
                <th key={p} className="py-2 px-3">
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const values = PERSONS.map((p) => row.get(store[p]));
              const nonEmpty = values.filter(Boolean);
              const counts = new Map<string, number>();
              for (const v of nonEmpty) counts.set(v, (counts.get(v) ?? 0) + 1);
              return (
                <tr key={row.label} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 pl-4 pr-2 font-medium text-[var(--text-secondary)] whitespace-nowrap">{row.label}</td>
                  {values.map((v, i) => {
                    const agree = v && (counts.get(v) ?? 0) >= 2;
                    return (
                      <td
                        key={i}
                        className={`py-2 px-3 ${agree ? "bg-[color-mix(in_oklab,var(--good)_16%,transparent)] font-semibold text-[var(--good)]" : ""}`}
                      >
                        {display(row.label, v)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

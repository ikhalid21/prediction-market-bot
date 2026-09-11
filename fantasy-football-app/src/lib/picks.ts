import type { TeamInfo } from "./types";

export const PERSONS = ["Isa", "Shahe", "Charlie"] as const;
export type Person = (typeof PERSONS)[number];

export const DIVISIONS = [
  "AFC East",
  "AFC North",
  "AFC South",
  "AFC West",
  "NFC East",
  "NFC North",
  "NFC South",
  "NFC West",
] as const;
export type DivisionKey = (typeof DIVISIONS)[number];

export interface NflPicks {
  divisions: Record<DivisionKey, string>;
  afcChampion: string;
  nfcChampion: string;
  superBowlChampion: string;
  mvp: string;
  offensivePlayerOfYear: string;
  defensivePlayerOfYear: string;
  rookieOfYear: string;
  updatedAt: string | null;
}

export type PicksStore = Record<Person, NflPicks>;

export const AWARD_FIELDS: { key: keyof Pick<NflPicks, "mvp" | "offensivePlayerOfYear" | "defensivePlayerOfYear" | "rookieOfYear">; label: string; placeholder: string }[] = [
  { key: "mvp", label: "MVP", placeholder: "e.g. Josh Allen" },
  { key: "offensivePlayerOfYear", label: "Offensive Player of the Year", placeholder: "e.g. Ja'Marr Chase" },
  { key: "defensivePlayerOfYear", label: "Defensive Player of the Year", placeholder: "e.g. Micah Parsons" },
  { key: "rookieOfYear", label: "Rookie of the Year", placeholder: "e.g. Caleb Williams" },
];

const STORAGE_KEY = "ff-lab-nfl-picks-2026";

function emptyPicks(): NflPicks {
  return {
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
    updatedAt: null,
  };
}

export function emptyStore(): PicksStore {
  return PERSONS.reduce((acc, p) => {
    acc[p] = emptyPicks();
    return acc;
  }, {} as PicksStore);
}

export function loadStore(): PicksStore {
  const base = emptyStore();
  if (typeof window === "undefined") return base;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<PicksStore>;
    for (const person of PERSONS) {
      const saved = parsed[person];
      if (saved) {
        base[person] = {
          ...base[person],
          ...saved,
          divisions: { ...base[person].divisions, ...(saved.divisions ?? {}) },
        };
      }
    }
    return base;
  } catch {
    return base;
  }
}

export function saveStore(store: PicksStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function divisionTeams(teams: TeamInfo[], division: DivisionKey): TeamInfo[] {
  const [conference, div] = division.split(" ") as [TeamInfo["conference"], string];
  return teams.filter((t) => t.conference === conference && t.division === div);
}

export function conferenceTeams(teams: TeamInfo[], conference: TeamInfo["conference"]): TeamInfo[] {
  return teams.filter((t) => t.conference === conference);
}

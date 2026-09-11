import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
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

const COLLECTION = "picks";

function personDocId(person: Person): string {
  return person.toLowerCase();
}

export function emptyPicks(): NflPicks {
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

function normalizePicks(raw: Partial<NflPicks> | undefined): NflPicks {
  const base = emptyPicks();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    divisions: { ...base.divisions, ...(raw.divisions ?? {}) },
  };
}

/** Subscribes to every person's picks in Firestore, live. Returns an unsubscribe function. */
export function subscribeToStore(onChange: (store: PicksStore) => void, onError?: (err: Error) => void) {
  return onSnapshot(
    collection(db, COLLECTION),
    (snapshot) => {
      const store = emptyStore();
      for (const person of PERSONS) {
        const docSnap = snapshot.docs.find((d) => d.id === personDocId(person));
        store[person] = normalizePicks(docSnap?.data() as Partial<NflPicks> | undefined);
      }
      onChange(store);
    },
    (err) => onError?.(err)
  );
}

/** Merge-writes a patch of fields into one person's picks document. */
export async function savePersonPicks(person: Person, patch: Partial<NflPicks>) {
  await setDoc(
    doc(db, COLLECTION, personDocId(person)),
    { ...patch, updatedAt: new Date().toISOString() },
    { merge: true }
  );
}

/** Fully replaces one person's picks document (used to clear it). */
export async function resetPersonPicks(person: Person) {
  await setDoc(doc(db, COLLECTION, personDocId(person)), { ...emptyPicks(), updatedAt: new Date().toISOString() });
}

export function divisionTeams(teams: TeamInfo[], division: DivisionKey): TeamInfo[] {
  const [conference, div] = division.split(" ") as [TeamInfo["conference"], string];
  return teams.filter((t) => t.conference === conference && t.division === div);
}

export function conferenceTeams(teams: TeamInfo[], conference: TeamInfo["conference"]): TeamInfo[] {
  return teams.filter((t) => t.conference === conference);
}

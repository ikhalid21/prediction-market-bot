import { createContext, useContext, useState, useMemo, type ReactNode } from "react";
import type { ScoringFormat } from "./types";

interface ScoringContextValue {
  format: ScoringFormat;
  setFormat: (f: ScoringFormat) => void;
}

const ScoringContext = createContext<ScoringContextValue | null>(null);

export function ScoringProvider({ children }: { children: ReactNode }) {
  const [format, setFormat] = useState<ScoringFormat>("ppr");
  const value = useMemo(() => ({ format, setFormat }), [format]);
  return <ScoringContext.Provider value={value}>{children}</ScoringContext.Provider>;
}

export function useScoring() {
  const ctx = useContext(ScoringContext);
  if (!ctx) throw new Error("useScoring must be used within ScoringProvider");
  return ctx;
}

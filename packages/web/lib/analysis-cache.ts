import type { AnalysisResult } from '@codeatlas/engine';
import type { ValidationResult } from '@codeatlas/llm-synthesis';

export interface CachedAnalysis {
  model: AnalysisResult;
  narrative: ValidationResult;
  cachedAt: string;
}

// In-memory only, deliberately simple for a single-process demo
// deployment — the analyze call (especially the LLM step) is expensive
// enough that re-running it on every dashboard page load would be slow
// and cost real money on every navigation. This is NOT the "SHOULD HAVE"
// Redis caching from docs/PLAN.md (repeat analysis of an unchanged
// commit) — it's simpler: just "don't call the LLM again just to redraw
// the same page." Lost on server restart; that's fine here.
//
// Stored on `globalThis`, not a plain module-level `let`: verified live
// (curl GET /api/analyze after a POST) that Next.js/Turbopack compiles
// Route Handlers and Server Components into separate module graphs in
// dev mode, so a plain `let` here gives each its OWN instance of this
// module — the Route Handler's write was invisible to the page. This is
// the same globalThis-singleton pattern commonly used for e.g. a Prisma
// client in Next.js, for the same underlying reason.
const globalForCache = globalThis as typeof globalThis & {
  __codeatlasAnalysisCache?: CachedAnalysis | null;
};

export function getCachedAnalysis(): CachedAnalysis | null {
  return globalForCache.__codeatlasAnalysisCache ?? null;
}

export function setCachedAnalysis(value: CachedAnalysis): void {
  globalForCache.__codeatlasAnalysisCache = value;
}

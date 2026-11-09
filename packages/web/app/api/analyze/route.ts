import path from 'node:path';
import { analyzeRepository } from '@codeatlas/engine';
import { synthesizeFindings, validateFindings } from '@codeatlas/llm-synthesis';
import { getCachedAnalysis, setCachedAnalysis, type CachedAnalysis } from '@/lib/analysis-cache';

// The analyzed repo is fixed by the server, never by the request body:
// accepting a path from the client would be an arbitrary filesystem read /
// git-in-any-directory primitive on a public deployment.
// CODEATLAS_REPO_PATH overrides the default (this monorepo, which assumes
// cwd = packages/web as with `next start` via the workspace script).
const REPO_PATH = process.env.CODEATLAS_REPO_PATH
  ? path.resolve(process.env.CODEATLAS_REPO_PATH)
  : path.resolve(process.cwd(), '..', '..');

// Each POST makes a paid Claude call. On a public deployment that must be
// bounded: at most one run per cooldown window, and never two at once.
const COOLDOWN_MS = Number(process.env.CODEATLAS_ANALYZE_COOLDOWN_SECONDS ?? '600') * 1000;

const globalForRun = globalThis as typeof globalThis & {
  __codeatlasAnalysisInFlight?: Promise<CachedAnalysis> | null;
};

async function runAnalysis(): Promise<CachedAnalysis> {
  const model = await analyzeRepository(REPO_PATH);
  const rawOutput = await synthesizeFindings(model);
  const narrative = validateFindings(rawOutput, model);
  const cached = { model, narrative, cachedAt: new Date().toISOString() };
  setCachedAnalysis(cached);
  return cached;
}

/**
 * Runs the full pipeline once — analyzeRepository (engine) ->
 * synthesizeFindings (live Claude API call) -> validateFindings (grounding)
 * — and caches the combined result. Concurrent callers share one in-flight
 * run; within the cooldown the cached result is returned with 429.
 */
export async function POST(): Promise<Response> {
  const inFlight = globalForRun.__codeatlasAnalysisInFlight;
  if (inFlight) {
    return Response.json(await inFlight);
  }

  const previous = getCachedAnalysis();
  const ageMs = previous ? Date.now() - Date.parse(previous.cachedAt) : Infinity;
  if (previous && ageMs < COOLDOWN_MS) {
    const retryAfter = Math.ceil((COOLDOWN_MS - ageMs) / 1000);
    return Response.json(previous, { status: 429, headers: { 'Retry-After': String(retryAfter) } });
  }

  const run = runAnalysis();
  globalForRun.__codeatlasAnalysisInFlight = run;
  try {
    return Response.json(await run);
  } catch (error) {
    console.error('analysis failed', error);
    return Response.json({ error: 'Analysis failed.' }, { status: 500 });
  } finally {
    globalForRun.__codeatlasAnalysisInFlight = null;
  }
}

/** Cheap: returns whatever the last POST computed, without re-running anything. */
export async function GET(): Promise<Response> {
  const cached = getCachedAnalysis();
  if (!cached) {
    return Response.json(
      { error: 'No analysis has been run yet. POST to /api/analyze first.' },
      { status: 404 },
    );
  }
  return Response.json(cached);
}

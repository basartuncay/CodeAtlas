import path from 'node:path';
import { analyzeRepository } from '@codeatlas/engine';
import { synthesizeFindings, validateFindings } from '@codeatlas/llm-synthesis';
import { getCachedAnalysis, setCachedAnalysis } from '@/lib/analysis-cache';

// Assumes this route runs with cwd = packages/web (true for `next dev`/`next
// start` run from this package, whether directly or via an npm workspace
// script). Self-analysis by default — demo beat 1 in docs/PLAN.md.
// Known fragility: this breaks if the server is ever started with a
// different cwd (e.g. a process manager that launches from the repo
// root). Not worth generalizing for a single-deployment demo project.
const DEFAULT_REPO_PATH = path.resolve(process.cwd(), '..', '..');

interface AnalyzeRequestBody {
  repoPath?: unknown;
}

/**
 * Runs the full pipeline once — analyzeRepository (engine) ->
 * synthesizeFindings (live Claude API call) -> validateFindings (grounding)
 * — and caches the combined result. Expensive; call this to (re-)run an
 * analysis, not on every page load (see GET below for that).
 *
 * SECURITY: `repoPath` from the request body is passed straight to
 * `analyzeRepository`, which reads that filesystem path and shells out to
 * `git` inside it — no sanitization, no allowlist. Fine for local/demo use
 * (trusted caller, single user) but this must NOT be exposed as-is on a
 * public deployment: a malicious `repoPath` is an arbitrary local
 * filesystem read / git-command-in-arbitrary-directory primitive.
 */
export async function POST(request: Request): Promise<Response> {
  const body: AnalyzeRequestBody = await request.json().catch(() => ({}));
  const repoPath = typeof body.repoPath === 'string' ? body.repoPath : DEFAULT_REPO_PATH;

  const model = await analyzeRepository(repoPath);
  const rawOutput = await synthesizeFindings(model);
  const narrative = validateFindings(rawOutput, model);

  const cached = { model, narrative, cachedAt: new Date().toISOString() };
  setCachedAnalysis(cached);

  return Response.json(cached);
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

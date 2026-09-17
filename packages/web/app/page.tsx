import { getCachedAnalysis } from "@/lib/analysis-cache";
import { DependencyGraph } from "@/components/DependencyGraph";
import { HotspotRankingTable } from "@/components/HotspotRankingTable";
import { NarrativePanel } from "@/components/NarrativePanel";
import { RunAnalysisButton } from "@/components/RunAnalysisButton";

// getCachedAnalysis() reads a plain in-memory value, not one of Next's
// recognized dynamic APIs (cookies/headers/searchParams) — without this,
// `next build` prerenders this page as STATIC (verified: it does, by
// default), baking in whatever the cache held at build time (always
// empty) forever, so a real POST /api/analyze afterward would never be
// reflected in production. Confirmed via a real `next build` run.
export const dynamic = "force-dynamic";

export default function Home() {
  const cached = getCachedAnalysis();

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">CodeAtlas</h1>
        <RunAnalysisButton />
      </header>

      {!cached ? (
        <p className="text-neutral-500">
          No analysis has been run yet. Click &ldquo;Run analysis&rdquo; above.
        </p>
      ) : (
        <>
          <div className="mb-6 text-sm text-neutral-500">
            <span className="font-mono">{cached.model.repo.commit.slice(0, 7)}</span>
            {" · "}
            {cached.model.modules.length} modules
            {" · "}
            analyzed {new Date(cached.model.repo.analyzed_at).toLocaleString()}
          </div>

          <div className="mb-10 space-y-8">
            <section>
              <h2 className="mb-3 text-lg font-medium">Hotspot ranking</h2>
              <div className="max-h-[420px] overflow-auto rounded border border-neutral-200">
                <HotspotRankingTable modules={cached.model.modules} />
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-medium">Dependency graph</h2>
              <DependencyGraph
                moduleIds={cached.model.modules.map((m) => m.id)}
                edges={cached.model.edges}
                cyclicModuleIds={cached.model.modules.filter((m) => m.in_cycle).map((m) => m.id)}
              />
            </section>
          </div>

          <section>
            <h2 className="mb-3 text-lg font-medium">Narrative</h2>
            <NarrativePanel
              summary={cached.narrative.summary}
              schemaValid={cached.narrative.schemaValid}
              acceptedFindings={cached.narrative.acceptedFindings}
              rejectedFindings={cached.narrative.rejectedFindings}
              showModuleLink
            />
          </section>
        </>
      )}
    </main>
  );
}

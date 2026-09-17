import { getCachedAnalysis } from "@/lib/analysis-cache";
import { HotspotRankingTable } from "@/components/HotspotRankingTable";
import { NarrativePanel } from "@/components/NarrativePanel";
import { RunAnalysisButton } from "@/components/RunAnalysisButton";

export default function Home() {
  const cached = getCachedAnalysis();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
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

          <section className="mb-10">
            <h2 className="mb-3 text-lg font-medium">Hotspot ranking</h2>
            <HotspotRankingTable modules={cached.model.modules} />
          </section>

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

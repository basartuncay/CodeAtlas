import Link from "next/link";
import { getCachedAnalysis } from "@/lib/analysis-cache";

function formatMetric(value: number): string {
  return Number.isNaN(value) ? "—" : value.toString();
}

export default async function ModuleDrillDown({
  params,
}: {
  params: Promise<{ id: string[] }>;
}) {
  const { id: idSegments } = await params;
  const moduleId = idSegments.join("/");

  const cached = getCachedAnalysis();

  if (!cached) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Back
        </Link>
        <p className="mt-4 text-neutral-500">No analysis has been run yet.</p>
      </main>
    );
  }

  const { model, narrative } = cached;
  // Named moduleResult, not `module` — Next.js's ESLint config flags
  // assigning to `module` (it's a reserved CJS interop identifier).
  const moduleResult = model.modules.find((m) => m.id === moduleId);

  if (!moduleResult) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Back
        </Link>
        <p className="mt-4 text-neutral-500">
          No module with id <span className="font-mono">{moduleId}</span> in the current
          analysis.
        </p>
      </main>
    );
  }

  const dependsOn = model.edges.filter((edge) => edge.from === moduleId).map((edge) => edge.to);
  const dependedOnBy = model.edges
    .filter((edge) => edge.to === moduleId)
    .map((edge) => edge.from);
  const risks = model.risks.filter((risk) => risk.module_id === moduleId);
  const accepted = narrative.acceptedFindings.filter((f) => f.module_id === moduleId);
  const rejected = narrative.rejectedFindings.filter((r) => r.finding.module_id === moduleId);

  const metrics: Array<[string, string]> = [
    ["loc", moduleResult.loc.toString()],
    ["cyclomatic_complexity", moduleResult.cyclomatic_complexity.toString()],
    ["fan_in", moduleResult.fan_in.toString()],
    ["fan_out", moduleResult.fan_out.toString()],
    ["instability", formatMetric(moduleResult.instability)],
    ["churn_commits_90d", moduleResult.churn_commits_90d.toString()],
    ["hotspot_score", formatMetric(moduleResult.hotspot_score)],
    ["blast_radius", moduleResult.blast_radius.toString()],
    ["in_cycle", moduleResult.in_cycle ? "true" : "false"],
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← Back
      </Link>

      <h1 className="mt-4 mb-6 break-all font-mono text-xl font-semibold">{moduleResult.id}</h1>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-neutral-500">Metrics</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {metrics.map(([key, value]) => (
            <div key={key}>
              <dt className="font-mono text-xs text-neutral-500">{key}</dt>
              <dd className="font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-neutral-500">
          Risks {risks.length === 0 ? "(none)" : `(${risks.length})`}
        </h2>
        {risks.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {risks.map((risk) => (
              <li key={risk.rule} className="rounded border border-amber-300 bg-amber-50 p-2">
                <span className="font-mono text-xs text-amber-800">{risk.rule}</span>
                <span className="ml-2 text-neutral-600">({risk.severity})</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-neutral-500">
          Depends on ({dependsOn.length})
        </h2>
        <ModuleLinkList moduleIds={dependsOn} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-neutral-500">
          Depended on by ({dependedOnBy.length})
        </h2>
        <ModuleLinkList moduleIds={dependedOnBy} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-neutral-500">
          Narrative findings for this module
        </h2>
        {accepted.length === 0 && rejected.length === 0 ? (
          <p className="text-sm text-neutral-500">No findings cite this module.</p>
        ) : (
          <ul className="space-y-3">
            {accepted.map((finding, i) => (
              <li key={`accepted-${i}`} className="border-l-4 border-green-500 pl-3 text-sm">
                <p>{finding.claim}</p>
                <p className="mt-1 text-xs text-green-700">
                  ✓ Verified: {finding.supporting_metric} = {finding.value_cited}
                </p>
              </li>
            ))}
            {rejected.map((rejection, i) => (
              <li key={`rejected-${i}`} className="border-l-4 border-red-500 pl-3 text-sm">
                <p className="text-neutral-500 line-through">{rejection.finding.claim}</p>
                <p className="mt-1 font-mono text-xs text-red-700">
                  ⚠ Rejected — {rejection.detail}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function ModuleLinkList({ moduleIds }: { moduleIds: string[] }) {
  if (moduleIds.length === 0) {
    return <p className="text-sm text-neutral-500">—</p>;
  }
  return (
    <ul className="space-y-1 text-sm">
      {moduleIds.map((id) => (
        <li key={id}>
          <Link href={`/module/${id}`} className="font-mono text-xs text-blue-600 hover:underline">
            {id}
          </Link>
        </li>
      ))}
    </ul>
  );
}

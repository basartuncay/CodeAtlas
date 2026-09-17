import Link from "next/link";
import type { ModuleResult } from "@codeatlas/engine";

function formatMetric(value: number): string {
  return Number.isNaN(value) ? "—" : value.toString();
}

export function HotspotRankingTable({ modules }: { modules: ModuleResult[] }) {
  const ranked = [...modules].sort((a, b) => b.hotspot_score - a.hotspot_score);

  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="border-b border-neutral-300 text-left text-neutral-500">
          <th className="py-1.5 pr-3 font-medium">Module</th>
          <th className="py-1.5 pr-3 font-medium">Hotspot</th>
          <th className="py-1.5 pr-3 font-medium">Complexity</th>
          <th className="py-1.5 pr-3 font-medium">Churn (90d)</th>
          <th className="hidden py-1.5 pr-3 font-medium sm:table-cell">Instability</th>
          <th className="py-1.5 pr-3 font-medium">Cycle</th>
        </tr>
      </thead>
      <tbody>
        {ranked.map((module) => (
          <tr key={module.id} className="border-b border-neutral-100">
            <td className="py-1.5 pr-3 font-mono" title={module.id}>
              <Link
                href={`/module/${module.id}`}
                className="block max-w-[220px] truncate text-blue-600 hover:underline"
              >
                {module.id}
              </Link>
            </td>
            <td className="py-1.5 pr-3 font-semibold">{formatMetric(module.hotspot_score)}</td>
            <td className="py-1.5 pr-3">{module.cyclomatic_complexity}</td>
            <td className="py-1.5 pr-3">{module.churn_commits_90d}</td>
            <td className="hidden py-1.5 pr-3 sm:table-cell">{formatMetric(module.instability)}</td>
            <td className="py-1.5 pr-3">
              {module.in_cycle ? (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">cycle</span>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

import Link from "next/link";
import type { ModuleResult } from "@codeatlas/engine";

function formatMetric(value: number): string {
  return Number.isNaN(value) ? "—" : value.toString();
}

export function HotspotRankingTable({ modules }: { modules: ModuleResult[] }) {
  const ranked = [...modules].sort((a, b) => b.hotspot_score - a.hotspot_score);

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b border-neutral-300 text-left text-neutral-500">
          <th className="py-2 pr-4 font-medium">Module</th>
          <th className="py-2 pr-4 font-medium">Hotspot</th>
          <th className="py-2 pr-4 font-medium">Complexity</th>
          <th className="py-2 pr-4 font-medium">Churn (90d)</th>
          <th className="py-2 pr-4 font-medium">Instability</th>
          <th className="py-2 pr-4 font-medium">Cycle</th>
        </tr>
      </thead>
      <tbody>
        {ranked.map((module) => (
          <tr key={module.id} className="border-b border-neutral-100">
            <td className="py-2 pr-4 font-mono text-xs">
              <Link href={`/module/${module.id}`} className="text-blue-600 hover:underline">
                {module.id}
              </Link>
            </td>
            <td className="py-2 pr-4 font-semibold">{formatMetric(module.hotspot_score)}</td>
            <td className="py-2 pr-4">{module.cyclomatic_complexity}</td>
            <td className="py-2 pr-4">{module.churn_commits_90d}</td>
            <td className="py-2 pr-4">{formatMetric(module.instability)}</td>
            <td className="py-2 pr-4">
              {module.in_cycle ? (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">cycle</span>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

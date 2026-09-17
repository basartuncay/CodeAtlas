import Link from "next/link";
import type { RawFinding, RejectedFinding } from "@codeatlas/llm-synthesis";

interface NarrativePanelProps {
  /** Omitted on the module drill-down page (findings are already scoped
   * to one module there — a top-level narrative summary doesn't apply). */
  summary?: string | null;
  schemaValid?: boolean;
  acceptedFindings: RawFinding[];
  rejectedFindings: RejectedFinding[];
  /** true on the home page (findings span many modules, so link each one);
   * false on a module's own drill-down page, where it would be redundant. */
  showModuleLink?: boolean;
}

export function NarrativePanel({
  summary,
  schemaValid = true,
  acceptedFindings,
  rejectedFindings,
  showModuleLink = false,
}: NarrativePanelProps) {
  if (!schemaValid) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-semibold">⚠ The LLM&apos;s response failed schema validation.</p>
        <p className="mt-1">No findings could be extracted from this run.</p>
      </div>
    );
  }

  return (
    <div>
      {summary ? <p className="mb-4 text-neutral-700 dark:text-neutral-300">{summary}</p> : null}

      <p className="mb-4 text-xs text-neutral-500">
        {acceptedFindings.length} verified · {rejectedFindings.length} rejected
      </p>

      {acceptedFindings.length === 0 && rejectedFindings.length === 0 ? (
        <p className="text-sm text-neutral-500">No findings.</p>
      ) : (
        <ul className="space-y-3">
          {acceptedFindings.map((finding, i) => (
            <AcceptedFindingItem key={`a-${i}`} finding={finding} showModuleLink={showModuleLink} />
          ))}
          {rejectedFindings.map((rejection, i) => (
            <RejectedFindingItem key={`r-${i}`} rejection={rejection} showModuleLink={showModuleLink} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AcceptedFindingItem({
  finding,
  showModuleLink,
}: {
  finding: RawFinding;
  showModuleLink: boolean;
}) {
  return (
    <li className="border-l-4 border-green-500 pl-3 text-sm">
      {showModuleLink ? (
        <Link href={`/module/${finding.module_id}`} className="font-mono text-xs text-blue-600 hover:underline">
          {finding.module_id}
        </Link>
      ) : null}
      <p>{finding.claim}</p>
      <p className="mt-1 text-xs text-green-700">
        ✓ Verified: {finding.supporting_metric} = {finding.value_cited}
      </p>
    </li>
  );
}

function RejectedFindingItem({
  rejection,
  showModuleLink,
}: {
  rejection: RejectedFinding;
  showModuleLink: boolean;
}) {
  return (
    <li className="border-l-4 border-red-500 pl-3 text-sm">
      {showModuleLink ? (
        <Link
          href={`/module/${rejection.finding.module_id}`}
          className="font-mono text-xs text-blue-600 hover:underline"
        >
          {rejection.finding.module_id}
        </Link>
      ) : null}
      <p className="text-neutral-500 line-through">{rejection.finding.claim}</p>
      <p className="mt-1 font-mono text-xs text-red-700">⚠ Rejected — {rejection.detail}</p>
    </li>
  );
}

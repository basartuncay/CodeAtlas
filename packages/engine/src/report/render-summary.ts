import type { AnalysisResult } from '../analyze/types';

export interface QualityGateResult {
  maxHotspotScore: number;
  threshold: number | null;
  passed: boolean;
}

/**
 * hotspot_score is NaN only when the whole analysis has <=1 module (ADR 0004).
 * Coerced to 0 so Math.max never turns into NaN and silently skips the gate.
 */
export function evaluateQualityGate(
  result: AnalysisResult,
  threshold: number | null,
): QualityGateResult {
  const scores = result.modules.map((m) => (Number.isNaN(m.hotspot_score) ? 0 : m.hotspot_score));
  const maxHotspotScore = scores.length > 0 ? Math.max(...scores) : 0;
  return { maxHotspotScore, threshold, passed: threshold === null || maxHotspotScore <= threshold };
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|');
}

/** Markdown report for a GitHub job summary or PR comment: deterministic, no LLM. */
export function renderSummary(
  result: AnalysisResult,
  gate: QualityGateResult,
  topN = 10,
): string {
  const top = [...result.modules]
    .filter((m) => !Number.isNaN(m.hotspot_score))
    .sort((a, b) => b.hotspot_score - a.hotspot_score || a.id.localeCompare(b.id))
    .slice(0, topN);

  const lines = [
    '## CodeAtlas report',
    '',
    `Commit \`${result.repo.commit.slice(0, 12)}\` · ${result.modules.length} modules · ` +
      `${result.cycles.length} cycles · ${result.risks.length} risks`,
    '',
    gate.threshold === null
      ? `Max hotspot score: **${gate.maxHotspotScore.toFixed(4)}** (no gate)`
      : `Quality gate: ${gate.passed ? '✅ passed' : '❌ failed'} — max hotspot score ` +
        `**${gate.maxHotspotScore.toFixed(4)}** (threshold ${gate.threshold})`,
    '',
  ];

  if (top.length > 0) {
    lines.push(
      `### Top ${top.length} hotspots`,
      '',
      '| Module | Hotspot | Complexity | Churn (90d) | Fan-in | Blast radius | In cycle |',
      '|---|---:|---:|---:|---:|---:|:---:|',
      ...top.map(
        (m) =>
          `| \`${escapeCell(m.id)}\` | ${m.hotspot_score.toFixed(3)} | ${m.cyclomatic_complexity} | ` +
          `${m.churn_commits_90d} | ${m.fan_in} | ${m.blast_radius} | ${m.in_cycle ? '⚠️' : ''} |`,
      ),
      '',
    );
  }

  if (result.cycles.length > 0) {
    lines.push('### Dependency cycles', '');
    for (const cycle of result.cycles) {
      lines.push(`- ${cycle.map((id) => `\`${escapeCell(id)}\``).join(' → ')}`);
    }
    lines.push('');
  }

  const highRisks = result.risks.filter((r) => r.severity === 'high');
  if (highRisks.length > 0) {
    lines.push('### High-severity risks', '');
    for (const risk of highRisks) {
      lines.push(`- \`${escapeCell(risk.module_id)}\` — ${risk.rule}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

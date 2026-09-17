"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RunAnalysisButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "running" | "error">("idle");

  async function runAnalysis() {
    setStatus("running");
    try {
      const response = await fetch("/api/analyze", { method: "POST" });
      if (!response.ok) {
        throw new Error(`analyze request failed: ${response.status}`);
      }
      setStatus("idle");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={runAnalysis}
        disabled={status === "running"}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {status === "running" ? "Analyzing…" : "Run analysis"}
      </button>
      {status === "error" ? <span className="text-sm text-red-600">Analysis failed.</span> : null}
    </div>
  );
}

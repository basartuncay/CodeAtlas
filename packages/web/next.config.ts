import path from "node:path";
import type { NextConfig } from "next";

// Next.js only auto-loads .env files from this package's own directory
// (packages/web/), not the monorepo root — but the single .env this
// project uses (ANTHROPIC_API_KEY) lives at the repo root, alongside the
// other packages that also read it. Load it explicitly; ignore if absent
// (e.g. CI, where the key is injected as a real env var instead).
try {
  process.loadEnvFile(path.resolve(process.cwd(), "..", "..", ".env"));
} catch {
  // no root .env — fine, env vars may already be set another way
}

const nextConfig: NextConfig = {
  // dependency-cruiser is a Node.js CLI-style library (dynamic `require`
  // calls, a tsconfig-paths-webpack-plugin dependency reaching into
  // enhanced-resolve internals) — bundling it through Turbopack/webpack
  // breaks ("Module not found: enhanced-resolve/lib/createInnerCallback",
  // "Module not found: Can't resolve <dynamic>"). Opting it out of
  // bundling lets the Node.js runtime `require` it directly, which is how
  // it's designed to run. ts-morph/typescript (also engine dependencies)
  // are already in Next.js's own default externals list, so only this one
  // needs adding.
  serverExternalPackages: ["dependency-cruiser"],
};

export default nextConfig;

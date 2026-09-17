// Leaf module: no internal imports. Everything else in this fixture
// transitively depends on it — see EXPECTED.md's blast_radius numbers.
export function log(message: string): void {
  console.log(`[cyclic-project] ${message}`);
}

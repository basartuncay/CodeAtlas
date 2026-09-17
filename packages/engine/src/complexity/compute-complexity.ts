import path from 'node:path';
import { Node, Project, SyntaxKind } from 'ts-morph';
import type { ComplexityResult } from './types';

// See fixtures/complex-functions/EXPECTED.md for the exact, hand-verified
// rule set this implements (which AST node kinds count as a decision
// point, and which are deliberately excluded).
const FUNCTION_KINDS = [
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.FunctionExpression,
  SyntaxKind.ArrowFunction,
];

const DECISION_KINDS = new Set([
  SyntaxKind.IfStatement,
  SyntaxKind.ConditionalExpression,
  SyntaxKind.ForStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.WhileStatement,
  SyntaxKind.DoStatement,
  SyntaxKind.CaseClause,
  SyntaxKind.CatchClause,
]);

const SHORT_CIRCUIT_OPERATORS = new Set(['&&', '||', '??']);

function isFunctionLike(node: Node): boolean {
  return FUNCTION_KINDS.includes(node.getKind());
}

/**
 * Complexity of a single function, counting only decision points in its
 * OWN body — traversal stops at any nested function-like node so that
 * nested functions get their own separate complexity, never double-
 * counted into the enclosing function's number.
 */
function complexityOfFunction(fn: Node): number {
  let complexity = 1;

  fn.forEachDescendant((descendant, traversal) => {
    if (isFunctionLike(descendant)) {
      traversal.skip();
      return;
    }
    if (DECISION_KINDS.has(descendant.getKind())) {
      complexity += 1;
      return;
    }
    if (Node.isBinaryExpression(descendant) && SHORT_CIRCUIT_OPERATORS.has(descendant.getOperatorToken().getText())) {
      complexity += 1;
    }
  });

  return complexity;
}

/** File-level complexity = sum over every function-like node in the file. See ADR 0003. */
function complexityOfFile(functions: Node[]): number {
  return functions.reduce((total, fn) => total + complexityOfFunction(fn), 0);
}

export function computeComplexity(projectRoot: string): ComplexityResult[] {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  project.addSourceFilesAtPaths([
    path.join(projectRoot, '**/*.ts'),
    `!${path.join(projectRoot, '**/*.d.ts')}`,
    `!${path.join(projectRoot, '**/node_modules/**')}`,
  ]);

  return project
    .getSourceFiles()
    .map((sourceFile) => {
      const functions = FUNCTION_KINDS.flatMap((kind) => sourceFile.getDescendantsOfKind(kind));
      const moduleId = path.relative(projectRoot, sourceFile.getFilePath()).split(path.sep).join('/');
      return {
        module_id: moduleId,
        cyclomatic_complexity: complexityOfFile(functions),
      };
    })
    .sort((a, b) => a.module_id.localeCompare(b.module_id));
}

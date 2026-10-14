import { readFile } from "node:fs/promises";
import type { ValidatedAssertion } from "@repo/matching";
import { env } from "../env.js";
import { getLlmClient } from "../llm.js";
import { extractProfile, type ExtractionResult } from "../profile/extract.js";

type Expected = {
  subject: string;
  field: string;
  value: unknown;
  status?: string;
  importance?: "low" | "medium" | "high";
  proposedHardConstraint?: boolean;
};

type Case = {
  id: string;
  conversation: { id: string; role: "user" | "assistant"; content: string }[];
  expected: Expected[];
  forbidden: { subject: string; field: string }[];
  followUps: string[];
};

const CASES_URL = new URL(
  "../../../../docs/evals/profile-extraction-cases.json",
  import.meta.url,
);
// Fixed so birth-date ages in the cases do not drift over time.
const TODAY = new Date("2026-10-13T00:00:00Z");
const CONCURRENCY = 5;

const { cases } = JSON.parse(await readFile(CASES_URL, "utf8")) as {
  cases: Case[];
};
const only = process.argv[2];
const selected = only ? cases.filter((c) => c.id === only) : cases;

console.log(
  `Running ${selected.length} extraction case(s) with ${env.extractionModel}\n`,
);

const results = await mapLimit(selected, CONCURRENCY, async (testCase) => {
  try {
    const result = await extractProfile(getLlmClient(), env.extractionModel, {
      existing: [],
      context: [],
      messages: testCase.conversation,
      today: TODAY,
    });
    return { testCase, result, report: grade(testCase, result) };
  } catch (error) {
    return { testCase, error: error as Error };
  }
});

let matchedActual = 0;
let totalActual = 0;
let matchedExpected = 0;
let totalExpected = 0;
let violations = 0;
let missedFollowUps = 0;
let failedCases = 0;
let inputTokens = 0;
let outputTokens = 0;

for (const entry of results) {
  if ("error" in entry) {
    failedCases += 1;
    console.log(`ERROR ${entry.testCase.id}: ${entry.error?.message}`);
    continue;
  }
  const { testCase, result, report } = entry;
  matchedActual += report.matchedActual;
  totalActual += result.accepted.length;
  matchedExpected += report.matchedExpected;
  totalExpected += testCase.expected.length;
  violations += report.violations.length;
  missedFollowUps += report.missedFollowUps.length;
  inputTokens += result.usage.inputTokens ?? 0;
  outputTokens += result.usage.outputTokens ?? 0;

  const passed = report.problems.length === 0;
  if (!passed) failedCases += 1;
  console.log(`${passed ? "PASS" : "FAIL"} ${testCase.id}`);
  for (const problem of report.problems) console.log(`     ${problem}`);
  if (!passed || process.env.EVAL_VERBOSE) {
    for (const a of result.accepted) console.log(`     got ${describe(a)}`);
    for (const r of result.rejected) {
      console.log(
        `     rejected ${r.proposal.subject}.${r.proposal.field}: ${r.reason}`,
      );
    }
    if (result.followUps.length > 0) {
      console.log(`     follow-ups: ${result.followUps.join(", ")}`);
    }
  }
}

const precision = totalActual === 0 ? 1 : matchedActual / totalActual;
const recall = totalExpected === 0 ? 1 : matchedExpected / totalExpected;
const criteria = [
  ["Hard-rule violations", violations === 0, String(violations)],
  ["Precision >= 90%", precision >= 0.9, percent(precision)],
  ["Recall >= 80%", recall >= 0.8, percent(recall)],
  [
    "Expected follow-ups triggered",
    missedFollowUps === 0,
    `${missedFollowUps} missed`,
  ],
] as const;

console.log(
  `\nCases: ${selected.length - failedCases}/${selected.length} passed · tokens: ${inputTokens} in, ${outputTokens} out`,
);
for (const [name, ok, value] of criteria) {
  console.log(`${ok ? "✓" : "✗"} ${name}: ${value}`);
}
process.exitCode = criteria.every(([, ok]) => ok) ? 0 : 1;

function grade(testCase: Case, result: ExtractionResult) {
  const problems: string[] = [];
  const violations: string[] = [];
  const used = new Set<ValidatedAssertion>();

  let matchedExpected = 0;
  for (const expected of testCase.expected) {
    const match = result.accepted.find(
      (a) => !used.has(a) && matches(expected, a),
    );
    if (match) {
      used.add(match);
      matchedExpected += 1;
    } else {
      problems.push(`missing ${describeExpected(expected)}`);
    }
  }
  const matchedActual = result.accepted.filter((a) =>
    testCase.expected.some((e) => matches(e, a)),
  ).length;

  for (const a of result.accepted) {
    const forbidden = testCase.forbidden.some(
      (f) =>
        f.field === a.field && (f.subject === "any" || f.subject === a.subject),
    );
    if (forbidden) violations.push(`forbidden ${a.subject}.${a.field}`);
    const hardExpected = testCase.expected.some(
      (e) => e.proposedHardConstraint && matches(e, a),
    );
    if (a.proposedHardConstraint && !hardExpected) {
      violations.push(`unexpected dealbreaker ${a.subject}.${a.field}`);
    }
  }
  const expectsUnder18 = testCase.followUps.includes("under_18");
  if (result.under18 !== expectsUnder18) {
    violations.push(`under_18 should be ${expectsUnder18}`);
  }

  const missedFollowUps = testCase.followUps.filter(
    (f) => !result.followUps.includes(f as never),
  );
  for (const f of missedFollowUps) problems.push(`missing follow-up ${f}`);
  problems.push(...violations.map((v) => `VIOLATION ${v}`));

  return {
    problems,
    violations,
    missedFollowUps,
    matchedActual,
    matchedExpected,
  };
}

function matches(expected: Expected, actual: ValidatedAssertion): boolean {
  if (expected.subject !== actual.subject || expected.field !== actual.field) {
    return false;
  }
  if (!valueMatches(expected.value, actual.value)) return false;
  if (expected.status && expected.status !== actual.status) return false;
  if (
    expected.proposedHardConstraint !== undefined &&
    expected.proposedHardConstraint !== actual.proposedHardConstraint
  ) {
    return false;
  }
  if (
    expected.importance &&
    expected.importance !== importanceLabel(actual.importance)
  ) {
    return false;
  }
  return true;
}

/** Strings match loosely (case, containment, or every expected word present); lists must contain every expected item. */
function valueMatches(expected: unknown, actual: unknown): boolean {
  if (typeof expected === "string" && typeof actual === "string") {
    const e = expected.toLowerCase().trim();
    const a = actual.toLowerCase().trim();
    if (e === a || a.includes(e) || e.includes(a)) return true;
    const actualWords = new Set(a.split(/\W+/));
    return e.split(/\W+/).every((word) => actualWords.has(word));
  }
  if (Array.isArray(expected) && Array.isArray(actual)) {
    return expected.every((e) => actual.some((a) => valueMatches(e, a)));
  }
  if (
    expected &&
    actual &&
    typeof expected === "object" &&
    typeof actual === "object"
  ) {
    return Object.entries(expected).every(([k, v]) =>
      valueMatches(v, (actual as Record<string, unknown>)[k]),
    );
  }
  return expected === actual;
}

function importanceLabel(weight: number | null) {
  if (weight === null) return null;
  return weight >= 0.9 ? "high" : weight >= 0.5 ? "medium" : "low";
}

function describe(a: ValidatedAssertion) {
  const flags = [
    a.status,
    a.importance !== null && `importance ${importanceLabel(a.importance)}`,
    a.proposedHardConstraint && "dealbreaker",
  ].filter(Boolean);
  return `${a.subject}.${a.field} = ${JSON.stringify(a.value)} (${flags.join(", ")})`;
}

function describeExpected(e: Expected) {
  return `${e.subject}.${e.field} = ${JSON.stringify(e.value)}${e.status ? ` (${e.status})` : ""}`;
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        out[index] = await fn(items[index]!);
      }
    }),
  );
  return out;
}

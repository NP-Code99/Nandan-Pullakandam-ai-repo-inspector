import type { ChangedFile, ValidationResult } from "./types.js";

type ReportInput = {
  repositoryPath: string;
  changedFiles: ChangedFile[];
  validationResults: ValidationResult[];
};

/**
 * Picks a fence long enough that `content` cannot close it. CommonMark only
 * lets a fenced block be closed by a fence at least as long as its opener, so
 * a fence one backtick longer than the longest run in the content is safe for
 * any run length -- unlike a fixed ``` fence, which validation output
 * containing ``` could break out of to forge headings and file entries.
 */
function fenceFor(content: string): string {
  const longestRun = [...content.matchAll(/`+/g)].reduce(
    (max, [run]) => Math.max(max, run.length),
    0,
  );
  return "`".repeat(Math.max(3, longestRun + 1));
}

/** Keeps an untrusted single-line value from spanning lines and forging structure. */
function singleLine(value: string): string {
  return value.replace(/\r?\n|\r/g, " ");
}

export function markdownReport(input: ReportInput): string {
  const lines = [`# Review Report: ${input.repositoryPath}`, "", "## Changed files"];
  for (const file of input.changedFiles) {
    lines.push(`- ${file.path} (${file.status})`);
  }
  lines.push("", "## Validation output");
  for (const result of input.validationResults) {
    const fence = fenceFor(result.output);
    // The command string is caller-supplied too (MCP validationCommands), so a
    // newline in it could otherwise open a forged "## " section of its own.
    lines.push(
      `### ${singleLine(result.command)}`,
      // Without this the report never stated pass/fail, so a reader could not
      // tell a green run from a red one.
      `Status: **${result.status === "passed" ? "PASSED" : "FAILED"}**`,
      "",
      fence,
      result.output,
      fence,
    );
  }
  return lines.join("\n");
}
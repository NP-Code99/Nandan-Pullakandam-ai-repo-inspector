// ACCEPTED RISK (timeboxed scope): commands are executed verbatim through a
// shell with no sandboxing or allowlisting; callers are fully trusted.
import { exec } from "node:child_process";
import type { ValidationResult } from "./types.js";

/** Wall-clock limit for a single validation command. Adjust here. */
export const VALIDATION_TIMEOUT_MS = 30_000;
/** Max bytes captured from a single validation command. Adjust here. */
export const VALIDATION_MAX_BUFFER_BYTES = 8 * 1024 * 1024;

type ExecError = Error & { code?: number | string; killed?: boolean; signal?: string | null };

/**
 * Runs one command and always resolves. A failing validation is a result to
 * report, not an exception: rejecting here previously aborted the whole review
 * and produced no report at all, which is the exact case the tool exists for.
 */
export function runValidation(command: string, cwd: string): Promise<ValidationResult> {
  return new Promise((resolve) => {
    exec(
      command,
      { cwd, timeout: VALIDATION_TIMEOUT_MS, maxBuffer: VALIDATION_MAX_BUFFER_BYTES },
      (error, stdout, stderr) => {
        // Both streams matter on failure: a failing suite usually writes its
        // diagnostics to stderr while still producing stdout.
        const output = [stdout, stderr].filter(Boolean).join("").trim();
        const notes: string[] = [];
        const execError = error as ExecError | null;

        // Node kills the child once maxBuffer is exceeded, but the partial
        // output is still worth reporting -- previously this surfaced as
        // ERR_CHILD_PROCESS_STDIO_MAXBUFFER and destroyed the entire run.
        if (execError?.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
          notes.push(`[output truncated at ${VALIDATION_MAX_BUFFER_BYTES} bytes]`);
        } else if (execError?.killed) {
          notes.push(`[timed out after ${VALIDATION_TIMEOUT_MS}ms, killed with ${execError.signal}]`);
        } else if (typeof execError?.code === "number") {
          notes.push(`[exited with code ${execError.code}]`);
        } else if (execError) {
          notes.push(`[could not run command: ${execError.message}]`);
        }

        resolve({
          command,
          // Truncation alone is not a failure signal: the command was cut off
          // for producing too much output, not for reporting a problem.
          status:
            execError && execError.code !== "ERR_CHILD_PROCESS_STDIO_MAXBUFFER"
              ? "failed"
              : "passed",
          output: [output, ...notes].filter(Boolean).join("\n"),
        });
      },
    );
  });
}

export async function runValidations(commands: string[], cwd: string): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  for (const command of commands) {
    results.push(await runValidation(command, cwd));
  }
  return results;
}
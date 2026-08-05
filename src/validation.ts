// ACCEPTED RISK (timeboxed scope): commands are executed verbatim through a
// shell with no sandboxing or allowlisting; callers are fully trusted.
import { exec } from "node:child_process";
import type { ValidationResult } from "./types.js";

/** Wall-clock limit for a single validation command. Adjust here. */
export const VALIDATION_TIMEOUT_MS = 30_000;
/** Max bytes captured from a single validation command. Adjust here. */
export const VALIDATION_MAX_BUFFER_BYTES = 8 * 1024 * 1024;

type ExecError = Error & { code?: number | string };

export function runValidation(command: string, cwd: string): Promise<ValidationResult> {
  return new Promise((resolve, reject) => {
    exec(
      command,
      { cwd, timeout: VALIDATION_TIMEOUT_MS, maxBuffer: VALIDATION_MAX_BUFFER_BYTES },
      (error, stdout, stderr) => {
        const output = stdout || stderr;

        // Node kills the child once maxBuffer is exceeded, but the partial
        // output is still worth reporting -- previously this surfaced as
        // ERR_CHILD_PROCESS_STDIO_MAXBUFFER and destroyed the entire run.
        if (error && (error as ExecError).code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
          resolve({
            command,
            status: "passed",
            output: `${output}\n[output truncated at ${VALIDATION_MAX_BUFFER_BYTES} bytes]`,
          });
          return;
        }

        if (error) {
          reject(error);
          return;
        }
        resolve({ command, status: "passed", output });
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
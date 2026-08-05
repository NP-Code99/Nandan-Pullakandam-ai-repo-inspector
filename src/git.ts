import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import type { ChangedFile } from "./types.js";

/**
 * Resolves a caller-supplied repository path, failing loudly rather than
 * letting an unusable value reach `execFileSync`, where `cwd: undefined`
 * silently falls back to the current process's directory.
 */
export function assertGitRepository(repositoryPath: string | undefined): string {
  if (typeof repositoryPath !== "string" || repositoryPath.trim() === "") {
    throw new Error("A repository path is required.");
  }

  let stats;
  try {
    stats = statSync(repositoryPath);
  } catch {
    throw new Error(`Repository path does not exist: ${repositoryPath}`);
  }

  if (!stats.isDirectory()) {
    throw new Error(`Repository path is not a directory: ${repositoryPath}`);
  }

  try {
    git(repositoryPath, ["rev-parse", "--is-inside-work-tree"]);
  } catch {
    throw new Error(`Repository path is not a Git repository: ${repositoryPath}`);
  }

  return repositoryPath;
}

/** Wall-clock limit for a single git invocation. Adjust here. */
export const GIT_TIMEOUT_MS = 30_000;
/** Max bytes captured from a single git invocation. Adjust here. */
export const GIT_MAX_BUFFER_BYTES = 32 * 1024 * 1024;

function git(repositoryPath: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repositoryPath,
    encoding: "utf8",
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: GIT_MAX_BUFFER_BYTES,
  }).trim();
}

export function changedFiles(repositoryPath: string, baseRef?: string): ChangedFile[] {
  const base = baseRef ?? "main";

  // `git` is spawned via execFileSync with an argv array and no shell, so shell
  // metacharacters in baseRef were never a risk. The real exposure was git's own
  // option parser: `${base}...HEAD` is one argv token, and a base such as
  // "--output=/tmp/x" made that token start with "-", so git consumed it as a
  // flag and wrote an arbitrary file. Git forbids refnames starting with "-"
  // (git check-ref-format), so rejecting them loses no legitimate input, and
  // --end-of-options forces anything that follows to parse as a revision even
  // on paths where this check is later relaxed.
  if (base.startsWith("-")) {
    throw new Error(`Invalid base ref (must not start with "-"): ${base}`);
  }

  const output = git(repositoryPath, [
    "diff",
    "--name-status",
    "--end-of-options",
    `${base}...HEAD`,
    "--",
  ]);

  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [code, ...pathParts] = line.split("\t");
      const status = code === "A" ? "added" : code === "D" ? "deleted" : "modified";
      return { path: pathParts.join("\t"), status };
    });
}
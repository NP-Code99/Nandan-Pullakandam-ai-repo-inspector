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

function git(repositoryPath: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repositoryPath,
    encoding: "utf8",
  }).trim();
}

export function changedFiles(repositoryPath: string, baseRef?: string): ChangedFile[] {
  const base = baseRef ?? "main";
  const output = git(repositoryPath, ["diff", "--name-status", `${base}...HEAD`]);

  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [code, ...pathParts] = line.split("\t");
      const status = code === "A" ? "added" : code === "D" ? "deleted" : "modified";
      return { path: pathParts.join("\t"), status };
    });
}
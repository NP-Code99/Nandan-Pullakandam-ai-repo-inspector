#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { reviewRepository } from "./core.js";
import { assertGitRepository } from "./git.js";

const server = new McpServer({ name: "repository-inspector", version: "2.0.0" });

server.tool(
  "review_repository",
  "Inspects a Git repository and returns a review report.",
  {
    repo_path: z.string().describe("Repository path to inspect."),
    baseRef: z.string().optional(),
    validationCommands: z.array(z.string()).optional(),
  },
  async (input) => {
    // NOTE (triage): the CLI does not yet perform this same validation, so the
    // two interfaces still differ in how they reject a bad --repo/repo_path.
    try {
      const repositoryPath = assertGitRepository(input.repo_path);
      const report = await reviewRepository({
        repositoryPath,
        baseRef: input.baseRef,
        validationCommands: input.validationCommands,
      });
      return { content: [{ type: "text", text: report }] };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: [{ type: "text", text: `review_repository failed: ${message}` }],
      };
    }
  },
);

await server.connect(new StdioServerTransport());
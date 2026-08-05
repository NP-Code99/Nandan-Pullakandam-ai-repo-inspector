# Submission

## What did you investigate first, and why?

I started with the MCP tool contract, because that is the interface an AI agent calls on its own and cannot sanity check. It turned out to be broken. The tool advertised an input called repo_path but the code read a differently spelled name, so the value was always empty and it inspected whatever folder the server happened to be running in and reported that back as a success. I also made a point of checking the README against the code rather than trusting it, and drove both interfaces for real instead of just reading the source, mainly because typecheck, test and build all pass on the starter, so a green build proves almost nothing here.

## What did you choose to implement or fix?

I ended up making seven fixes, each in its own commit with the reproduction and verification written into the commit message. The first three were about making the interfaces actually do what they advertise, so the MCP tool now reads the input name it declares, rejects a bad repository path instead of silently falling back to its own folder, and no longer cuts repository paths off at the first space. The next three closed injection holes, where a crafted branch name could make Git write files, command output could break out of its code block and fake entire report sections, and a hung or very noisy command could kill the whole run. The last one matters most day to day, since a failing check used to throw and produce no report at all.

## What did you intentionally not do?

I deliberately left the shell execution itself alone, since sandboxing or allowlisting the validation commands was agreed to be out of scope, and I marked that in the code as an accepted risk. I also only escaped part of the report, so command output is now safe but the file paths and the repository path are still inserted raw, and I would rather say that plainly than claim the report is fully sealed. Beyond that I left the CLI exit codes, the renamed file handling, the ignored format flag, the wrong packaged build path and the npm audit findings, and I did not add regression tests, which is honestly the biggest weakness of this submission.

## Interface decision

**Decision.** I went with CLI-first, keeping MCP around but making it deliberately narrower.

**Primary user and execution environment.** Basically a developer, or a CI job, running against a repository they already have checked out.

**Trust boundary and allowed capabilities.** Someone running the CLI already has shell access, so letting them run validation commands hands them nothing new, but an AI agent calling over MCP doesn't have that access and giving it arbitrary commands hands it privileges it never had. Both accept them equally right now, so I would keep the CLI as is and lock MCP down to inspection only.

**Reliability, discoverability, latency and output tradeoffs.** MCP is much easier to discover since the schema describes itself, but the CLI wins on output, because a big report is fine sitting on disk and way too large for an agent's context window.

**How supported interfaces remain consistent.** All of the real work happens in one shared core and the two adapters just translate input and output, so any difference between them should be about transport and not behavior.

**Evidence that would change this decision.** If most of the calls actually turned out to come from agents rather than humans, or if the validation step got properly sandboxed, then MCP-first would make a lot more sense.

## How did you use an AI coding agent?

So for the AI Coding Agent. I primarily utilized one chat to essentially plan and design this entire project and see what I was going to do and that same chat also provided all of the prompts that I would provide to the actual agent that's going to be working on this project. So essentially one agent was doing all of the prompting and the other agent was doing all of the "doing". I also used AI to help formulate some of the answers for the Submission aswell and make sure that I didn't miss anything that only the AI would know itself. 

## Where did you check, correct, or reject an AI suggestion? (required)

Whenever the AI made changes for the tests and actually did the validation for each of the tests I made sure that it properly and adequately checked all of the edge cases since these are usually ignored and forgotten. Funnily enough, my prompting agent essentially told me to also look into these and make sure to check it properly since the AI itself might make very minor errors and overlook a lot of the edge cases. Furthermore, a lot of times, the agent would commit and merge branches with the main branch without actually verifying any of the results and implementations that it had just created which was also a point where I stopped and made sure that it looked very carefully. 

## Commands used to verify the result, with outcomes

So I ran typecheck, tests and the build after every single commit, and then re-ran all of it at the end on the final branch. The four checks below are the ones I actually care about, since each of them straight up fails on the original code, and the rest were mostly edge cases around those.

Everything CI runs still passes:

```
npm ci -> 0    npm run typecheck -> 0    npm run build -> 0
npm test -> Test Files 1 passed (1), Tests 1 passed (1)
```

The MCP tool actually uses the repository you ask it for now, and properly refuses a bad one instead of quietly reporting on whatever folder it happens to be sitting in. I ran these with the server started inside a valid repository on purpose, because that is exactly the situation where the old behaviour would have handed back a convincing but completely wrong report:

```
repo_path = <a real repo>   -> # Review Report: /.../sample   (was "# Review Report: undefined")
repo_path = /does/not/exist -> isError: Repository path does not exist
repo_path = /tmp            -> isError: Repository path is not a Git repository
```

A branch name starting with a dash can't trick Git into writing files anymore. The first line here is the actual attack working on plain Git, which is what convinced me the original suggested fix wasn't going to help:

```
git diff --name-status '--output=/tmp/X...HEAD'   -> creates the file /tmp/X...HEAD
--base-ref '--output=/tmp/ARGINJ'                 -> rejected, no file created
--base-ref main / HEAD~1 / refs/heads/main        -> still produce a normal report
```

And a failing check now actually gets reported instead of taking the whole run down with it, which is honestly the fix that matters most day to day:

```
--validate 'exit 1'  -> Status: FAILED, [exited with code 1], report still written
                        (previously: Fatal error, no report at all)
--validate 'echo ok' --validate 'exit 3' --validate 'nosuchcommand'
                     -> all three reported, codes 3 and 127 captured, run continued
```

On top of those I checked the code block escaping against output containing three, four, five, seven and twenty backticks, made sure a two million line output gets truncated with a note instead of crashing, and confirmed a hung command gets killed at thirty seconds while the checks after it still run. That came out to twenty behaviour checks in total, all passing.

## A blocker you hit and how you approached it

The main one was realising that the suggested fix for the base ref vulnerability was aimed at the wrong problem entirely, and would have changed nothing about the actual bug. I reproduced the attack against plain Git first and watched it create a file on disk, which made it obvious that the proposed fix could not possibly help. Doing that before patching is what stopped a change that did nothing from shipping as a security fix. A smaller one was my own test for the code block fix, which failed and looked like a real regression until I realised the test was wrong rather than the code.

## Known limitations and the next three things you would do

The biggest limitation is that none of the seven fixes have regression tests, so everything was verified by running it rather than by something that would catch a regression later. The report escaping is also only partial, the CLI still does not validate paths the way the MCP side now does, errors print as raw stack traces, and a large report is far too big to sit comfortably in an agent's context window. The next three things I would do, in order, are adding regression tests with a helper that builds throwaway repositories, giving the CLI meaningful exit codes and readable errors so it can actually be used in CI, and then fixing the remaining correctness bugs before limiting the report size.

## Approximate focused-work time

- Start: 5:52 PM
- Finish: 7:22 PM 

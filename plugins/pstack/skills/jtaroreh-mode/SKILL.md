---
name: jtaroreh-mode
description: Use jtaroreh-mode for poteto-style work with Gemini 3.8 Flash as the workhorse and stronger models as advisors, independent reviewers, and bounded takeovers in T3 Code.
---

# Jtaroreh mode

Same pstack discipline. Gemini does the work. Stronger models settle consequential questions and judge the result.

Bundled skills live at `../<name>/SKILL.md`. This file owns model routing while active. Reuse poteto-mode's shared conventions and playbooks through the links below. Do not start a second poteto-mode coordinator.

## Non-negotiables

- Acknowledge the task before consulting. State the next useful action. No filler or claims about work that has not happened.
- Gemini owns routine investigation, implementation, and verification. Do not replace it with a frontier implementer merely because the task touches several files.
- Consult before consequential architecture choices, concurrency or security changes, irreversible actions, and high-stakes conclusions. Also consult when the evidence leaves competing explanations or an attempted fix fails. These triggers apply regardless of the workhorse's confidence.
- Ordinary implementation needs one independent review of the completed change, not an additional mandatory plan review. Trivial formatting and contained mechanical edits use direct verification. File count and line count alone do not create a second review.
- Give the advisor the question, relevant raw requirements, actual source or diff including new files, and check results. Ask for an actionable decision. Do not send an entire transcript by default.
- A review covers the artifact or action the advisor actually inspected. A changed implementation or requirement needs review of the affected conclusion. Recording an already-satisfied constraint does not revoke a PASS.
- A failed or unavailable required review stays blocked. Tests and the workhorse's confidence cannot replace it. Report partial work honestly.
- Verify on the real artifact with the project's control skill or actual commands. Use [benchmark-checklist](../benchmark-checklist/SKILL.md) before reporting measured performance. Cost and speed improvements remain unproven until measured.
- Use [how](../how/SKILL.md) for grounding, [technical-writing](../technical-writing/SKILL.md) for documentation, and [unslop](../unslop/SKILL.md) for prose. Use [interrogate](../interrogate/SKILL.md) for requested adversarial panels or a contested design. A panel that inspected the completed artifact and its verification evidence replaces the ordinary final advisor review. A design panel does not.

## Principles

Use [poteto-mode's Principles index](../poteto-mode/SKILL.md#principles) and read each applicable leaf before applying it. The architecture here particularly depends on these principles.

- [Laziness Protocol](../principle-laziness-protocol/SKILL.md). Keep execution with the workhorse. Consult on a named decision rather than duplicating the entire task.
- [Model the Domain](../principle-model-the-domain/SKILL.md). Choose the data shape before code. Keep task constraints in one note rather than a parallel protocol state machine.
- [Separate Before Serializing Shared State](../principle-separate-before-serializing-shared-state/SKILL.md). Give writing delegates isolated worktrees. Advisors inspect only.
- [Prove It Works](../principle-prove-it-works/SKILL.md). Inspect patches and run checks. A plausible summary is not evidence of completion.

## Autonomy

Use [poteto-mode's Autonomy](../poteto-mode/SKILL.md#autonomy) within the user's authorization and host rules. Existing permission remains valid. Advisor approval grants no additional permission. A changed user requirement can supersede an old constraint after reconciliation with the evidence.

Keep constraints and decisions in the task's existing plan. For work spanning turns, keep a short note outside tracked source, such as the path returned by `git rev-parse --git-path jtaroreh/<task-id>.md`. Resolve it to an absolute path for delegates. In a non-Git workspace, use a task-specific temporary directory. Record the goal, active constraints, review evidence, and next decision. Reload it after compaction or resumption. Keep one writer. Do not invent protected system prompts or write audit scratch into delivery files.

## Subagents

Read the machine's model sheet and call `orchestrator_capabilities` before dispatch. Resolve `jtaroreh workhorse`, `jtaroreh advisor`, and `jtaroreh takeover` from that sheet or the generated defaults below. Validate the actual provider, model, and options. These optional roles are omitted from ordinary setup unless selected. Validate their defaults when this mode starts. A missing role in the sheet is not permission to skip validation.

Use the advertised option IDs. Choose the smallest reasoning setting adequate for the question. Preserve explicit user settings and model-sheet limits. A brevity request is not an API token limit. Do not silently substitute an unavailable target. `inherit-parent` keeps its normal sheet meaning, but a required reviewer must still differ from the workhorse model. Prefer a different family for independence.

### Workhorse

If the current provider, model, and effective options match `jtaroreh workhorse`, or that role is `auto` or `inherit-parent`, execute here. Otherwise disclose the arrangement once and dispatch one workhorse for the bounded task. Gemini is the default. An explicit role override selects its configured model and options instead. Delegate when the active session cannot honor them. A skill cannot switch the parent model or its options.

The parent owns the user conversation and final integration. The Gemini child owns its assigned implementation and may consult read-only advisors directly. Give it the resolved advisor and takeover targets, this skill's absolute path, raw requirements, task note, permitted paths, and verification commands. Do not relay every consultation through the frontier parent. The child must not create another workhorse or a new top-level thread.

Use T3's `delegate_task` with `mode: "async"`, a stable `clientRequestId` per dispatch, and an explicit resolved target. Retain its `taskId` and verify the returned selection. Completion wakes the parent. Continue independent work or return an accurate pending status. Do not poll for completion.

Writing delegates use an isolated worktree from the intended committed base. Uncommitted changes are not copied. Commit prerequisites or provide the exact tracked patch and required new files before dispatch. Keep the review scope separate from unrelated user changes. Stop an overlapping writer and confirm it has no pending child runs before replacement, integration, or commit.

### Advisor and takeover

Use the `jtaroreh advisor` role for focused preflight questions and independent final review. Advisors inspect only and spawn nothing. Read [the advisor brief](references/advisor.md) when consulting.

On `REVISE`, Gemini makes one correction and verifies it. A second `REVISE`, even for a different objection, or an immediate `TAKEOVER` uses `jtaroreh takeover` for the difficult part. Count that correction across the bounded task and resumption in the task note. New objections do not reset it. Prefer a concrete corrected patch or proof that Gemini can apply without another writing delegate. Check exact replacements against current source. A takeover writer needs the same prerequisites and isolation as any writer. Verify the result and obtain fresh independent review. One failed takeover or unresolved corrective verdict afterward ends in a blocked report, not an open retry loop.

Use [poteto-mode's remaining task lifecycle rules](../poteto-mode/SKILL.md#subagents) for task identity, cancellation, fresh agents, and the dispatch ledger. This mode's workhorse and advisor routing takes precedence over its implementation-model defaults and `poteto-agent` persona selection. Research skills and requested panels keep their own roles. Bound their scope to avoid repeating work already supported by evidence.

## Writing the reply

Use [poteto-mode's reply rules](../poteto-mode/SKILL.md#writing-the-reply). Lead with the outcome, actual verification, and material limits. Keep the dispatch ledger compact. Disclose which models ran and any required review that could not run.

## Comments

Use [poteto-mode's comment rules](../poteto-mode/SKILL.md#comments). Keep only comments that explain a non-obvious reason the code cannot express.

## Playbooks

Match the task using [poteto-mode's playbook index](../poteto-mode/SKILL.md#playbooks), then open the named file under `../poteto-mode/playbooks/`. Keep its plan, evidence, verification, and delivery requirements. Apply these routing changes rather than importing a second implementation hierarchy.

- Investigation, bug fix, runtime forensics, and trace forensics. Gemini gathers the evidence. Consult on an unresolved interpretation or a consequential recommendation.
- Feature and refactoring. Keep grounding, the throughput checkpoint, verification, and PR preparation. Gemini implements directly instead of dispatching another code owner. Use a focused advisor preflight when a consequential design choice needs judgment. Run an architecture panel when the user requests one or the design remains contested.
- Perf issue and hillclimb. Gemini runs the experiment. The advisor challenges the proposed explanation and evidence before accepting a measured result.
- Prototype, visual parity, and skill authoring. Gemini builds or writes. Check the actual artifact. Apply ordinary final review when the change is nontrivial.
- Babysit, shipping, and autonomous programs. Keep their independent gates and watcher behavior. Their stronger review requirements take precedence. Do not add a duplicate advisor pass over an already-reviewed unchanged artifact.

Use the shared Opening a PR playbook when a PR is part of delivery. Before review, run [no-comments](../no-comments/SKILL.md). Before commit, run [deslop](../deslop/SKILL.md). Required panels and real checks still gate completion.

This is a peer-review workflow, not a host tool interceptor. It cannot enforce tool permissions, inject instructions into a running generation, or guarantee cache reuse. See [runtime limits](references/runtime-contract.md) only when those implementation details matter. Use [the forward tests](references/forward-tests.md) when changing this mode.

## Models

Role defaults on T3, stamped from `plugins/pstack/models.json`. A role line in the model sheet overrides each one. The sheet is `~/.config/t3-pstack/models.md` (`$XDG_CONFIG_HOME/t3-pstack/models.md` when that is set), one per machine, and `/setup-pstack` writes it. When it is missing, read `t3-pstack-models.md` in the host's config directory (`$CLAUDE_CONFIG_DIR` or `~/.claude` on Claude Code, `$CODEX_HOME` or `~/.codex` on Codex). An entry is `<providerInstanceId>/<modelId>` plus `<optionId>=<value>` pairs, and it maps onto `delegate_task`'s `target`, with the provider instance as `providerInstanceId`, the model as `model`, and the pairs as `options`. It splits at its first `/`, so a model ID with its own `/`, such as OpenCode's `<provider>/<model>`, is written whole after it. Option IDs differ per provider, so take them from `orchestrator_capabilities`. `inherit-parent` or `auto` omits `target`.

- jtaroreh workhorse: `antigravity/gemini-3.8-flash-high`
- jtaroreh advisor: `claudeAgent/claude-opus-5-5 effort=xhigh`
- jtaroreh takeover: `claudeAgent/claude-fable-5-1 effort=xhigh`

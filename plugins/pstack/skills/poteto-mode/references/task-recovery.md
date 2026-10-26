# Resume bounded work

Use this guide when work spans a handoff, compaction, interruption, or repeated verification attempts. Keep one checkpoint in the task's existing note. Do not create another scheduler or state store.

This is an agent workflow. It does not enforce attempt limits or restore a process automatically.

## Keep a checkpoint

Use the note location the active mode already defines. Otherwise, keep the note outside tracked source, such as the path from `git rev-parse --git-path pstack/<task-id>.md`. Resolve that output to an absolute path. For a non-Git task, use a task-specific directory outside the delivery files. Give delegates the absolute note path and keep one writer.

Record only what the next actor needs:

- Goal, current user constraints, and the next action.
- Worktree path, branch, HEAD, and changes already present when the task began.
- Current phase and whether work is active, waiting, passed, exhausted, or blocked.
- Attempts used and the limit for a repeated corrective loop. Preserve any limit the user or playbook already sets.
- Outstanding task IDs, their provider and model, owned paths, and the last observed state.
- Last verification receipt and the exact scope covered by independent review.

Before starting a repeated corrective loop without a limit, choose a finite limit appropriate to the task and state it. Count an attempt before starting its corrective work. A failed check, interruption, new objection, or handoff does not reset the count. Extend a limit only under existing authorization that covers the extension, and record why.

## Record verification receipts

After a check, keep a short receipt in the same note:

```text
Command and working directory:
Tested state: HEAD plus tracked and untracked changes in scope
Outcome: pass, fail, timeout, interrupted, unresolved, or could not run
Exit code: actual value, or unknown
Evidence: absolute output path or durable tool artifact
Next action:
```

Name the tested changes or preserve their diff and relevant untracked contents. HEAD alone does not identify uncommitted work. Preserve the evidence a reviewer needs outside tracked source. Do not copy credentials into notes or evidence.

An interrupted check or missing result is not a pass. Reuse a receipt only when the current changes and environment relevant to that check still match its tested scope. After a code change, rerun affected checks. Preserve the active playbook's review requirements.

## Resume from evidence

1. Read the checkpoint and reconcile later user instructions before acting.
2. Inspect the actual worktree, HEAD, and dirty changes. Preserve user work. A changed revision is a reason to reconcile, never permission to reset, clean, or discard files.
3. Reconcile outstanding task IDs with the host's supported lifecycle. Do not start another writer for paths still owned by a live task. Follow the host's wait or completion instruction. If task state cannot be established, report it as unknown and continue only independent work.
4. Check receipts against the current scope. Treat stale or unavailable evidence as unverified. An independent review remains valid only for the artifact and action it actually covered.
5. Continue from the recorded next action within the remaining attempt limit. If the limit is reached, stop the corrective loop and report exhausted. If a dependency or required review prevents progress, report blocked and name what is missing.

Before handing work back, link the latest receipt and state what remains. Claim passed only when the required checks and reviews cover the delivered state. A passing command proves its own predicate, not the whole task.

## Deliver evidence at the right size

For a substantial change, link the plan, final verification evidence, and a short account of the resulting behavior. Keep intermediate logs and checkpoints as scratch evidence. For a small change, a concise reply with the relevant receipt is enough. Use the current host's file or artifact links rather than Antigravity-specific brain paths or metadata.

## Run a bounded verifier

For a Git worktree, [verify-task.mjs](../scripts/verify-task.mjs) executes one verification attempt per invocation. Use a note inside Git metadata or outside the worktree. It appends a machine-readable contract to that same note and preserves its existing text.

```sh
node <plugin>/skills/poteto-mode/scripts/verify-task.mjs init --note /absolute/task.md --cwd /absolute/worktree --verify "bun test" --limit 3 --timeout 120
node <plugin>/skills/poteto-mode/scripts/verify-task.mjs run --note /absolute/task.md
node <plugin>/skills/poteto-mode/scripts/verify-task.mjs status --note /absolute/task.md
```

Review the saved command before running it. The command executes with the caller's permissions. Each run spends one verification attempt before execution and writes a redacted output tail beside the note. This verifier budget does not replace the active playbook's corrective or review limits.

A pass requires exit zero and unchanged tracked and untracked contents during verification. Later worktree changes make the receipt stale. Environment changes still require the agent to decide which checks to rerun. Interruptions and timeouts never pass. An unresolved prior process blocks another attempt. Reinitializing the same note cannot replenish its budget. The helper neither repairs code nor schedules work, resets Git, or grants review approval.

If an interrupted attempt has no recorded child PID, automatic recovery cannot prove that no child started. Inspect the command's processes first. After establishing that all its processes stopped, `reconcile --note /absolute/task.md --assert-stopped` records that operator assertion and marks the attempt interrupted. It never restores the spent attempt or turns its receipt into a pass. Known live processes still block reconciliation.

The timeout includes a bounded termination grace period. Descendants that escape their process group cannot be assumed stopped. If output pipes remain open after group termination, the verifier closes observation, records unresolved cleanup, and blocks another attempt until explicit reconciliation.

# Advisor brief

Send a focused question and enough primary evidence to answer it. Use absolute source paths, the actual scoped diff, relevant new files, raw user requirements, active constraints, and verification results. Capture the diff being reviewed outside tracked source. If source changes during review, reconcile the changed parts before using the verdict.

```text
Inspect only. Change no file, perform no mutation, and spawn no child.
Question or review scope: <one bounded decision>
Raw requirements: <request and relevant corrections>
Current source and diff: <absolute paths, base commit, scoped diff, relevant new files>
Active constraints: <task note and relevant entries>
Evidence: <actual commands, output, observations, and unresolved assumptions>

Find actionable correctness defects, security errors, races, unsupported assumptions,
or missing verification within this scope. Return PASS, REVISE, or TAKEOVER.
Name concrete evidence and the required correction. Include a small exact patch when useful.
List lasting constraints separately. Explain enough for the workhorse to implement the fix.
Do not provide private reasoning. No fixed word limit is required.
```

A PASS applies to the inspected decision, artifact, or proposed action. Record useful constraints without restarting review merely to record them. If a proposed constraint requires a change to the current artifact, the verdict must be REVISE. Repeated or unsupported constraints do not become new requirements.

For an action review, provide the exact command or tool arguments, target, expected effect, and relevant preconditions. PASS permits that action only within existing authorization. Execute it once, verify the observed result, and report it. Changed arguments, requirements, or preconditions require reassessment. A resumed session must inspect whether the action already happened before retrying it.

For final review, include the actual checks and full delivery scope. A plan PASS does not approve a later implementation. A malformed response, failed call, or missing evidence is not PASS. Clarify one unusable response with a fresh advisor task. If it remains unusable or unavailable, report the required review blocked.

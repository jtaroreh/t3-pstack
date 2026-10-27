# Agystack capabilities integrated for T3 Code

This pass used the local `pstack-agy` source and `cursor_pstack_comparison.md` as inputs. T3 retains task scheduling, provider routing, child lifecycles, and workspace ownership. The useful additions extend pstack's existing notes, installer, swarm tools, and cloud bridge.

## Added

- Runtime diagnostics extend `tools/install.mjs doctor` with optional local and cloud prerequisites. Catalog validation now covers live string, numeric, and boolean option values as well as legacy option records. Subprocess checks cover missing binaries, timeouts, output redaction, and the absence of auth or network commands.
- Bounded executable verification extends the existing task note through `poteto-mode/scripts/verify-task.mjs`. Attempts survive interruption, a passing command records its exit code and tested work, and changed contents invalidate the receipt. Disposable Git repositories exercise failure, correction, passing verification, stale contents, exhaustion, timeout, and interruption.
- Worker steering and Q&A extend the existing cloud run identity. Stable message IDs prevent automatic replay after an uncertain delivery. The adapter uses native `StorageMessenger` envelopes with one create-only upload per message and refuses silent cloud-to-local fallback. CLI fixtures exercise context isolation, bounds, malformed output, failures, and concurrent cancellation. A separate manual local native-mailbox roundtrip checked question, reply, duplicate refusal, and broadcast behavior. The optional native-source tests now cover the roundtrip, lost steering acknowledgments, and paging across a large mailbox. Run them with `AGYSTACK_TEST_SOURCE=/path/to/pstack-agy bun test tests/cloud-mailbox.test.mjs`. These native compatibility tests skip when the source is absent. An ungated storage fixture separately exercises production cursor arguments and exact scan-cap boundaries in CI.
- Candidate ranking adds one reusable swarm helper. Mixed minimize/maximize directions, deterministic ties, optional Pareto filtering, and explicit exclusions work for local and cloud candidates. Real CLI tests cover failed high scores, missing metrics, and malformed identities. Verification remains parent-owned.
- Durable progress extends `attach` and adds `progress`. It retains 256 allowlisted aggregate events across observation restarts. A dedicated Cloud Run observer avoids the engine's implicit downloads. Tests inject split, malformed, oversized, and credential-bearing output. Observation never holds the cancellation lock. No worker transcripts are inserted into T3.
- Artifact discovery adds local paths, sizes, hashes, and quarantine status through `artifacts`. Harvesting also fetches optional `results.tsv` files omitted by the native harvester. Subprocess checks cover missing downloads, failures, interruption, and symlink escape attempts. A Python storage fixture verifies exact session keys and atomic TSV replacement.

See [cloud operations](../plugins/pstack/skills/t3-agystack/references/cloud-operations.md), [candidate ranking](../plugins/pstack/skills/swarm/references/candidate-ranking.md), and [bounded recovery](../plugins/pstack/skills/poteto-mode/references/task-recovery.md).

## Existing owners retained

Model tiers, independent review roles, and provider options belong to the model sheet and setup-pstack. T3 lifecycle tools own scheduling and child cancellation. The cloud bridge already owns dispatch, launch recovery, remote cancellation, attachment, and harvesting. Agystack's engine already supplies matrix manifests and cloud partner-model execution. These capabilities were retained rather than copied into a competing controller.

Task notes already distinguish durable deliverables from scratch evidence and link verification artifacts. Recovery extends that note rather than creating another state database.

## Excluded

Native hook interception, automatic formatter hooks, line-count delegation thresholds, and Antigravity brain metadata depend on host-specific behavior or impose unrelated policy. Synthetic transcript injection and a separate dashboard would duplicate T3's ownership and add another service. Cloud provisioning and authentication remain with agystack. Hardcoded model-availability claims and benchmark-specific seed defaults cannot generalize to T3 tasks.

## Validation limits

Cloud behavior is exercised through subprocess fixtures and native local-mailbox compatibility. No paid cloud job was launched, and live credentials, quota, worker polling, and production service behavior are not established by these checks. Ranking and artifact delivery never substitute for independent review or authorize patch application.

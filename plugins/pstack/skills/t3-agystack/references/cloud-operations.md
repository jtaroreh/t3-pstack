# Operate an existing cloud run

Use `node <skill>/scripts/cloud-run.mjs --help` for dispatch options. The examples below act on a run ID returned by dispatch. They reuse its recorded session, bucket, engine, and task count. Task indices start at zero.

## Steering and questions

```sh
node <skill>/scripts/cloud-run.mjs steer RUN_ID --task 0 --instruction 'Keep the public API unchanged.' --request-id steering-1 --json
node <skill>/scripts/cloud-run.mjs questions RUN_ID --json
node <skill>/scripts/cloud-run.mjs reply RUN_ID --task 0 --seq 1 --text 'Use the existing parser.' --request-id answer-1 --json
```

`steer` also accepts `--task all`. Only resolved, running executions accept mailbox operations. The worker must implement agystack's `StorageMessenger` protocol and check its inbox. A submitted response acknowledges storage delivery, not worker execution. An unavailable mailbox is an error, never an empty question list. `questions` returns `{questions, nextCursor}`. Pass a non-null `nextCursor` back as `--cursor CURSOR` until it becomes null. Each page scans at most 4095 mailbox objects and returns at most 256 pending questions. A non-null cursor means a page limit stopped the scan. Continue even when that page is empty. Only a null cursor proves the scan finished. Start a fresh scan without a cursor to pick up new questions written before an earlier cursor.

Reuse a message request ID only for the same input. The bridge reserves it before delivery and retains no plaintext message in the run record. A lost acknowledgment leaves that ID uncertain and prevents automatic resend. Inspect the worker mailbox before explicitly authorizing a new request ID. Replies cannot overwrite an existing answer. Broadcast delivery can stop partway through; an error does not mean that no task received it. Provider diagnostics are redacted, but message content itself is sent to the external worker mailbox.

## Observation and artifacts

```sh
node <skill>/scripts/cloud-run.mjs attach RUN_ID --json
node <skill>/scripts/cloud-run.mjs progress RUN_ID --json
node <skill>/scripts/cloud-run.mjs harvest RUN_ID --json
node <skill>/scripts/cloud-run.mjs artifacts RUN_ID --json
```

`attach` observes Cloud Run directly and keeps its last 256 aggregate counter events in private durable state. `progress` reads that history without contacting the cloud. Events have a run ID, `time`, `phase=progress`, and `taskIndex=null`, because observation exposes aggregate counters. No event proves a task's completion. Raw worker logs, thoughts, and tool arguments are excluded. Restarting observation preserves history. Observation never invokes the engine or downloads artifacts. Another attach is refused while an observer owns the run; cancellation remains available.

`harvest` uses agystack's candidate harvester, then fetches each task's optional `results.tsv` from the same session. A missing TSV is normal. Access failures fail harvesting. `artifacts` reads downloaded files and returns their task index, kind, absolute local path, byte count, SHA-256, and status. It neither downloads nor applies patches. Hashes describe the bytes currently on disk and can change while a quarantined harvest is still writing. Files from failed, cancelled, running, or incomplete harvests are quarantined. Successful downloads remain `unverified` until the coordinator checks them. Symlinks and unexpected task directories are refused. Files above 64 MiB are not hashed, and TSV downloads above that size are refused.

Use the existing `cancel` verb to stop remote execution. Interrupting observation, messaging, or harvesting does not request remote cancellation.

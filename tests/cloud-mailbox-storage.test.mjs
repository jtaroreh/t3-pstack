import { test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "mailbox-storage-"));
  const modules = join(root, "modules"), engine = join(root, "engine");
  mkdirSync(join(modules, "google/cloud"), { recursive: true }); mkdirSync(engine);
  for (const name of ["google/__init__.py", "google/cloud/__init__.py"]) writeFileSync(join(modules, name), "");
  writeFileSync(join(modules, "google/cloud/storage.py"), readFileSync("tests/fixtures/cloud/mailbox-storage.py"));
  writeFileSync(join(engine, "storage_messenger.py"), "class StorageMessenger:\n def __init__(self, *, bucket_name, storage_client, **kwargs): self.bucket=storage_client.bucket(bucket_name)\nMailboxEnvelope=MessageType=MessageStatus=object\n");
  writeFileSync(join(engine, "cloud_dispatch.py"), "");
  const objects = join(root, "objects.json"), log = join(root, "listing.log");
  const prefix = "swarms/t3-test/tasks/";
  return {
    root, prefix, log,
    seed(unrelated, questions) {
      const items = Array.from({ length: unrelated }, (_, index) => ({ name: `${prefix}task-0/inbox/${String(index).padStart(5, "0")}_steer.json` }));
      for (let seq = 1; seq <= questions; seq++) items.push({ name: `${prefix}task-0/outbox/${String(seq).padStart(4, "0")}_question.json`, content: { session_id: "t3-test", task_index: 0, seq, msg_type: "question", payload: { question: `Question ${seq}` } } });
      writeFileSync(objects, JSON.stringify(items));
    },
    page(cursor) {
      const result = spawnSync("python3", [resolve("plugins/pstack/skills/t3-agystack/scripts/cloud-mailbox.py"), "--engine", join(engine, "cloud_dispatch.py"), "--session-id", "t3-test", "--gcs-bucket", "test-bucket", "--max-tasks", "1", "--verb", "questions", ...(cursor ? ["--cursor", cursor] : [])], { encoding: "utf8", env: { ...process.env, PYTHONPATH: modules, PYTHONDONTWRITEBYTECODE: "1", MAILBOX_OBJECTS: objects, LIST_LOG: log } });
      expect(result.status, result.stderr).toBe(0); return JSON.parse(result.stdout);
    },
  };
}

test("production mailbox listing pages past unrelated objects without losing or repeating questions", () => {
  const f = fixture();
  try {
    f.seed(4100, 260);
    const first = f.page(); expect(first.questions).toHaveLength(0); expect(first.nextCursor).not.toBeNull();
    const second = f.page(first.nextCursor); expect(second.questions).toHaveLength(256);
    const third = f.page(second.nextCursor); expect(third.questions).toHaveLength(4); expect(third.nextCursor).toBeNull();
    expect(new Set([...second.questions, ...third.questions].map(q => q.seq)).size).toBe(260);
    const calls = readFileSync(f.log, "utf8").trim().split("\n").map(JSON.parse);
    expect(calls.map(c => c.start_offset)).toEqual([f.prefix, first.nextCursor, second.nextCursor]);
    expect(calls.every(c => c.max_results === 4096)).toBe(true);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("a scan ending exactly at its cap requires an empty continuation to prove exhaustion", () => {
  const f = fixture();
  try {
    f.seed(4095, 0);
    const first = f.page(); expect(first.questions).toEqual([]); expect(first.nextCursor).not.toBeNull();
    expect(f.page(first.nextCursor)).toEqual({ questions: [], nextCursor: null });
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

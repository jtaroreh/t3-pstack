import { test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const source = process.env.AGYSTACK_TEST_SOURCE;
(source ? test : test.skip)("native mailbox upload with a lost acknowledgment never allocates another steering envelope", () => {
  const root = mkdtempSync(join(tmpdir(), "mailbox-once-"));
  try {
    const code = `import sys, runpy\nsys.path.insert(0, sys.argv[1])\nimport storage_messenger as sm\noriginal = sm._LocalBlob.upload_from_string\ndef uncertain(self, *args, **kwargs):\n original(self, *args, **kwargs)\n raise TimeoutError('committed but acknowledgment lost')\nsm._LocalBlob.upload_from_string = uncertain\nsys.argv = [sys.argv[2], '--engine', sys.argv[3], '--verb', 'steer', '--session-id', 't3-test', '--gcs-bucket', 'test-bucket', '--max-tasks', '2', '--task', '0', '--text', 'Use the existing parser', '--local-dir', sys.argv[4]]\nrunpy.run_path(sys.argv[0], run_name='__main__')\n`;
    const scripts = join(source, "skills/swarm/scripts");
    const result = spawnSync("python3", ["-c", code, scripts, resolve("plugins/pstack/skills/t3-agystack/scripts/cloud-mailbox.py"), join(scripts, "cloud_dispatch.py"), root], { encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Mailbox operation failed");
    expect(readdirSync(join(root, "test-bucket/swarms/t3-test/tasks/task-0/inbox"))).toEqual(["0001_steer.json"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
(source ? test : test.skip)("native mailbox supports questions, create-only replies, stdin text, broadcast, and envelope rejection", () => {
  const root = mkdtempSync(join(tmpdir(), "mailbox-roundtrip-"));
  try {
    const scripts = join(source, "skills/swarm/scripts"), adapter = resolve("plugins/pstack/skills/t3-agystack/scripts/cloud-mailbox.py");
    const seed = `import sys\nsys.path.insert(0,sys.argv[1])\nfrom storage_messenger import StorageMessenger\nStorageMessenger(bucket_name='test-bucket',session_id='t3-test',task_index=0,local_dir=sys.argv[2]).send_question('Which parser?')\n`;
    expect(spawnSync("python3", ["-c", seed, scripts, root], { encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } }).status).toBe(0);
    const run = (verb, args = [], input) => spawnSync("python3", [adapter, "--engine", join(scripts, "cloud_dispatch.py"), "--local-dir", root, "--session-id", "t3-test", "--gcs-bucket", "test-bucket", "--max-tasks", "2", "--verb", verb, ...args], { encoding: "utf8", input, env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
    expect(JSON.parse(run("questions").stdout).questions).toEqual([{ taskIndex: 0, seq: 1, question: "Which parser?" }]);
    expect(run("reply", ["--task", "0", "--seq", "1", "--text-stdin"], "--force").status).toBe(0);
    expect(run("reply", ["--task", "0", "--seq", "1", "--text-stdin"], "replacement").status).toBe(1);
    expect(JSON.parse(run("questions").stdout).questions).toEqual([]);
    const broadcast = run("steer", ["--task", "all", "--text-stdin"], "Use the existing parser");
    expect(broadcast.status, broadcast.stderr).toBe(0); expect(JSON.parse(broadcast.stdout)).toHaveLength(2);
    const path = join(root, "test-bucket/swarms/t3-test/tasks/task-0/outbox/0001_question.json");
    const data = JSON.parse(readFileSync(path, "utf8")); data.session_id = "another-run"; writeFileSync(path, JSON.stringify(data));
    const malformed = run("questions"); expect(malformed.status).toBe(1); expect(malformed.stderr).toContain("MAILBOX_INPUT");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

(source ? test : test.skip)("question pagination advances past unrelated objects and returns every pending question", () => {
  const root = mkdtempSync(join(tmpdir(), "mailbox-pages-"));
  try {
    const scripts = join(source, "skills/swarm/scripts"), adapter = resolve("plugins/pstack/skills/t3-agystack/scripts/cloud-mailbox.py");
    const seed = `import sys\nfrom pathlib import Path\nsys.path.insert(0,sys.argv[1])\nfrom storage_messenger import StorageMessenger\nm=StorageMessenger(bucket_name='test-bucket',session_id='t3-test',task_index=0,local_dir=sys.argv[2])\nfor i in range(260): m.send_question('Question '+str(i))\ninbox=Path(sys.argv[2])/'test-bucket/swarms/t3-test/tasks/task-0/inbox'\ninbox.mkdir(parents=True,exist_ok=True)\nfor i in range(4100): (inbox/f'{i:04d}_steer.json').write_text('{}')\n`;
    expect(spawnSync("python3", ["-c", seed, scripts, root], { encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } }).status).toBe(0);
    let cursor = null; const questions = [], sizes = [];
    for (let page = 0; page < 5; page++) {
      const result = spawnSync("python3", [adapter, "--engine", join(scripts, "cloud_dispatch.py"), "--local-dir", root, "--session-id", "t3-test", "--gcs-bucket", "test-bucket", "--max-tasks", "1", "--verb", "questions", ...(cursor ? ["--cursor", cursor] : [])], { encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
      expect(result.status, result.stderr).toBe(0);
      const data = JSON.parse(result.stdout); sizes.push(data.questions.length); questions.push(...data.questions); cursor = data.nextCursor;
      if (cursor === null) break;
    }
    expect(cursor).toBeNull(); expect(sizes).toEqual([0, 256, 4]);
    expect(new Set(questions.map(q => q.seq)).size).toBe(260);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

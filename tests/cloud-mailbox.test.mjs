import { test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
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

import { test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, existsSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
test("real observation adapter reads counters without invoking the native engine or writing artifacts", () => {
  const root = mkdtempSync(join(tmpdir(), "cloud-observe-"));
  try {
    const gcloud = join(root, "gcloud");
    writeFileSync(gcloud, "#!/bin/sh\nprintf '%s\\n' '{\"status\":{\"succeededCount\":2,\"conditions\":[{\"type\":\"Completed\",\"status\":\"True\"}]}}'\n"); chmodSync(gcloud, 0o755);
    mkdirSync(join(root, ".slices")); symlinkSync(root, join(root, ".slices/t3-test"));
    const python = spawnSync("which", ["python3"], { encoding: "utf8" }).stdout.trim();
    const result = spawnSync(python, [resolve("plugins/pstack/skills/t3-agystack/scripts/cloud-observe.py"), "--execution", "job-one", "--project", "test", "--region", "us-central1", "--tasks", "2"], { cwd: root, encoding: "utf8", env: { ...process.env, PATH: root }, timeout: 5000 });
    expect(result.status, result.stderr).toBe(0); expect(result.stdout).toContain("2/2 succeeded");
    expect(existsSync(join(root, "task-0"))).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("terminal evidence is honored even when a counter sample is inconsistent", () => {
  const root = mkdtempSync(join(tmpdir(), "cloud-observe-counts-"));
  try {
    const gcloud = join(root, "gcloud");
    writeFileSync(gcloud, "#!/bin/sh\nprintf '%s\\n' '{\"status\":{\"succeededCount\":2,\"runningCount\":1,\"conditions\":[{\"type\":\"Completed\",\"status\":\"True\"}]}}'\n"); chmodSync(gcloud, 0o755);
    const python = spawnSync("which", ["python3"], { encoding: "utf8" }).stdout.trim();
    const result = spawnSync(python, [resolve("plugins/pstack/skills/t3-agystack/scripts/cloud-observe.py"), "--execution", "job-one", "--project", "test", "--region", "us-central1", "--tasks", "2"], { cwd: root, encoding: "utf8", env: { ...process.env, PATH: root }, timeout: 5000 });
    expect(result.status, result.stderr).toBe(0); expect(result.stdout).toBe("");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

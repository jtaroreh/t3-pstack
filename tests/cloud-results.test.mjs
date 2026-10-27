import { test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("results adapter fetches exact run keys atomically and fails on interrupted or unsafe downloads", () => {
  const root = mkdtempSync(join(tmpdir(), "cloud-results-"));
  try {
    const modules = join(root, "modules"); mkdirSync(join(modules, "google/cloud"), { recursive: true });
    for (const file of ["google/__init__.py", "google/cloud/__init__.py"]) writeFileSync(join(modules, file), "");
    writeFileSync(join(modules, "google/cloud/storage.py"), `import os, json\nclass Blob:\n name="swarms/t3-test/task-0/results.tsv"\n size=8\n generation=7\n def download_to_file(self, output, if_generation_match):\n  assert if_generation_match == 7\n  output.write(b'score\\t1\\n')\n  if os.environ.get('INTERRUPT_DOWNLOAD'): raise RuntimeError('interrupted')\nclass Bucket:\n def list_blobs(self, prefix):\n  assert prefix == 'swarms/t3-test/task-'\n  with open(os.environ['KEY_LOG'], 'a') as log: log.write(prefix+'\\n')\n  blobs = [Blob()]\n  alias = Blob(); alias.name = "swarms/t3-test/task-00/results.tsv"\n  return blobs + [alias]\nclass Client:\n def bucket(self, name):\n  assert name == 'test-bucket'\n  return Bucket()\n`);
    const dest = join(root, "artifacts"), keys = join(root, "keys");
    const args = ["plugins/pstack/skills/t3-agystack/scripts/cloud-results.py", "--session-id", "t3-test", "--gcs-bucket", "test-bucket", "--max-tasks", "2", "--destination", dest];
    const run = extra => spawnSync("python3", args, { encoding: "utf8", env: { ...process.env, PYTHONPATH: modules, PYTHONDONTWRITEBYTECODE: "1", KEY_LOG: keys, ...extra } });
    const delivered = run(); expect(delivered.status).toBe(0);
    expect(JSON.parse(delivered.stdout)).toEqual([{ taskIndex: 0, kind: "results" }]);
    const file = join(dest, "task-0/results.tsv");
    expect(readFileSync(file, "utf8")).toBe("score\t1\n");
    expect(readFileSync(keys, "utf8").trim().split("\n")).toEqual(["swarms/t3-test/task-"]);
    writeFileSync(file, "previous"); expect(run({ INTERRUPT_DOWNLOAD: "1" }).status).toBe(1);
    expect(readFileSync(file, "utf8")).toBe("previous");
    rmSync(join(dest, "task-0"), { recursive: true }); symlinkSync(root, join(dest, "task-0"));
    expect(run().status).toBe(1); expect(existsSync(join(root, "results.tsv"))).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

import { afterEach, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { doctorRuntime } from "../tools/install/runtime.mjs";
const roots = [];
afterEach(() => roots.splice(0).forEach(p => rmSync(p, { recursive: true, force: true })));
function fixture(script) {
  const root = mkdtempSync(join(tmpdir(), "pstack-doctor-")); roots.push(root);
  for (const name of ["node", "git", "python3", "gcloud"]) {
    const file = join(root, name); writeFileSync(file, `#!${process.execPath}\n${script}`); chmodSync(file, 0o755);
  }
  const source = join(root, "engine"); mkdirSync(join(source, "skills/swarm/scripts"), { recursive: true });
  writeFileSync(join(source, "skills/swarm/scripts/cloud_dispatch.py"), "");
  return { root, source };
}
test("cloud doctor runs only fixed local probes and does not echo provider output", () => {
  const f = fixture('require("fs").appendFileSync(process.env.PROBE_LOG, JSON.stringify(process.argv.slice(2))+"\\n"); console.log("tool 1.2.3 secret=DO_NOT_ECHO");');
  const log = join(f.root, "calls");
  const checks = doctorRuntime("cloud", { source: f.source, env: { PATH: f.root, PROBE_LOG: log } });
  expect(checks.every(c => c.ok)).toBe(true);
  expect(JSON.stringify(checks)).not.toContain("DO_NOT_ECHO");
  const calls = readFileSync(log, "utf8").trim().split("\n").map(JSON.parse);
  expect(calls).toHaveLength(5);
  expect(calls.every(a => a[0] === "--version" || a[0] === "-c")).toBe(true);
  expect(checks.find(c => c.name === "remote access").status).toBe("unknown");
});
test("missing executables are distinct from timed out probes", () => {
  const missing = doctorRuntime("local", { env: { PATH: "/nonexistent" } });
  expect(missing[0].status).toBe("missing");
  const f = fixture("setInterval(()=>{},1000)");
  expect(doctorRuntime("local", { env: { PATH: f.root }, timeout: 30 })[0].status).toBe("unknown");
});

test("v-prefixed executable versions retain their major number", () => {
  const f = fixture('console.log("v24.9.0")');
  const checks = doctorRuntime("local", { env: { PATH: f.root } });
  expect(checks[0].detail).toBe("24.9.0");
});

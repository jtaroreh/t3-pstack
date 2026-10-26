import { spawnSync } from "node:child_process";
import { enginePath } from "../../plugins/pstack/skills/t3-agystack/scripts/cloud-process.mjs";

function probe(name, args, env, timeout) {
  const result = spawnSync(name, args, { env, encoding: "utf8", timeout, maxBuffer: 4096, windowsHide: true });
  if (result.error?.code === "ENOENT") return { name, ok: false, status: "missing", detail: "not found on PATH" };
  if (result.error?.code === "ETIMEDOUT") return { name, ok: false, status: "unknown", detail: "version probe timed out; availability remains unconfirmed" };
  if (result.error || result.signal || result.status !== 0) return { name, ok: false, status: "unknown", detail: "probe did not complete successfully; output withheld" };
  return { name, ok: true, status: "ok", detail: result.stdout.match(/\d+\.\d+(?:\.\d+)?(?:[-+][\w.-]+)?/)?.[0] ?? "available" };
}

export function doctorRuntime(runtime, { env = process.env, cwd = process.cwd(), source, timeout = 2000 } = {}) {
  const checks = [probe("node", ["--version"], env, timeout), probe("git", ["--version"], env, timeout)];
  if (runtime === "cloud") {
    checks.push(probe("python3", ["--version"], env, timeout), probe("gcloud", ["--version"], env, timeout));
    try { checks.push({ name: "agystack engine", ok: true, status: "ok", detail: enginePath(source, cwd) }); }
    catch { checks.push({ name: "agystack engine", ok: false, status: "missing", detail: "pass --agystack-source with the local plugin directory" }); }
    const code = "import importlib.util, sys\ntry:\n found = all(importlib.util.find_spec(n) is not None for n in ['google.cloud.storage', 'google.genai'])\nexcept (ImportError, ModuleNotFoundError):\n found = False\nsys.exit(0 if found else 1)";
    const python = checks.find(c => c.name === "python3");
    const deps = python.ok ? probe("python3", ["-c", code], env, timeout) : { ok: false, status: python.status };
    checks.push({ ...deps, name: "cloud Python packages", detail: deps.ok ? "google.cloud.storage and google.genai found" : python.ok ? "package presence could not be confirmed in this python3" : "Python packages cannot be checked until python3 is available" });
  }
  checks.push({ name: "remote access", ok: true, status: "unknown", detail: "local diagnostics do not establish authentication, quota, or model availability" });
  return checks;
}

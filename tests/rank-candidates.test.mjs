import { test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rankCandidates } from "../plugins/pstack/skills/swarm/scripts/rank-candidates.mjs";
const metrics = [{ name: "score", direction: "max" }, { name: "latency", direction: "min" }];
const c = (id, score, latency, status = "verified") => ({ id, metrics: { score, latency }, status });
test("ranking honors directions, deterministic ties, verification and missing metrics", () => {
  const dir = mkdtempSync(join(tmpdir(), "rank-"));
  try {
    const input = join(dir, "candidates.json");
    writeFileSync(input, JSON.stringify([c("b", 10, 4), c("a", 10, 4), c("fast", 9, 1), c("failed", 999, 0, "failed"), c("missing", 20), c("string", "20", 1)]));
    const args = ["plugins/pstack/skills/swarm/scripts/rank-candidates.mjs", "--input", input, "--metric", "score:max", "--metric", "latency:min", "--json"];
    const run = spawnSync("node", args, { encoding: "utf8" });
    expect(run.status, run.stderr).toBe(0);
    const result = JSON.parse(run.stdout);
    expect(result.ranked.map(c => c.id)).toEqual(["a", "b", "fast"]);
    expect(result.excluded.map(c => c.id)).toEqual(["failed", "missing", "string"]);
    expect(JSON.parse(spawnSync("node", [...args, "--pareto"], { encoding: "utf8" }).stdout).ranked).toEqual(result.ranked);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test("Pareto excludes dominated candidates and rejects nonfinite and duplicate identities", () => {
  expect(rankCandidates([c("winner", 10, 1), c("slow", 10, 5), c("nan", NaN, 0), c("inf", Infinity, 0)], metrics, true).ranked.map(c => c.id)).toEqual(["winner"]);
  expect(() => rankCandidates([c("same", 1, 1), c("same", 2, 1)], metrics)).toThrow("unique");
});

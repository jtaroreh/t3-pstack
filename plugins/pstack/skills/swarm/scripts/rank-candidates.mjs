#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

export function rankCandidates(candidates, metrics, pareto = false) {
  if (!Array.isArray(candidates) || !metrics.length || metrics.some(m => !/^[A-Za-z_][\w.]*$/.test(m.name) || !["min", "max"].includes(m.direction))) throw Error("Supply candidates and at least one name:min|max metric.");
  const ids = new Set(), eligible = [], excluded = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate.id !== "string" || !candidate.id || ids.has(candidate.id)) throw Error("Candidate IDs must be unique nonempty strings.");
    ids.add(candidate.id);
    const missing = metrics.filter(m => typeof candidate.metrics?.[m.name] !== "number" || !Number.isFinite(candidate.metrics[m.name])).map(m => m.name);
    if (candidate.status !== "verified" || missing.length) excluded.push({ ...candidate, reason: candidate.status !== "verified" ? "unverified" : "missing-metrics", missing });
    else eligible.push(candidate);
  }
  const compareMetric = (a, b, m) => (a.metrics[m.name] > b.metrics[m.name] ? 1 : a.metrics[m.name] < b.metrics[m.name] ? -1 : 0) * (m.direction === "min" ? 1 : -1);
  const compare = (a, b) => metrics.reduce((result, m) => result || compareMetric(a, b, m), 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const ranked = eligible.filter(a => !pareto || !eligible.some(b => metrics.every(m => compareMetric(b, a, m) <= 0) && metrics.some(m => compareMetric(b, a, m) < 0))).sort(compare);
  const selected = new Set(ranked.map(c => c.id));
  for (const candidate of eligible) if (!selected.has(candidate.id)) excluded.push({ ...candidate, reason: "dominated" });
  excluded.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { metrics, pareto, ranked, excluded };
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  try {
    const { values, positionals } = parseArgs({ options: { input: { type: "string" }, metric: { type: "string", multiple: true }, pareto: { type: "boolean" }, json: { type: "boolean" }, help: { type: "boolean" } }, allowPositionals: true });
    if (values.help) console.log("Usage: rank-candidates.mjs --input FILE --metric score:max --metric latency_ms:min [--pareto] [--json]\nOnly status=verified candidates with finite numeric metrics qualify. Verification is caller-supplied. No patches are applied.");
    else {
      if (positionals.length || !values.input) throw Error("Supply --input FILE.");
      const metrics = (values.metric ?? []).map(value => { const [name, direction, extra] = value.split(":"); return { name, direction: extra ? "invalid" : direction }; });
      console.log(JSON.stringify(rankCandidates(JSON.parse(readFileSync(values.input, "utf8")), metrics, values.pareto), null, values.json ? 0 : 2));
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

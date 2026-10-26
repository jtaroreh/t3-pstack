# Compare verified candidates

Use `scripts/rank-candidates.mjs` when a local race or harvested cloud run has comparable numeric metrics. It ranks records without downloading or applying a patch.

```json
[
  {"id":"a","status":"verified","metrics":{"score":10,"latency_ms":4},"patchFile":"/tmp/a.diff","evidence":"/tmp/a-check.log"},
  {"id":"b","status":"verified","metrics":{"score":9,"latency_ms":2},"patchFile":"/tmp/b.diff","evidence":"/tmp/b-check.log"}
]
```

```sh
node <swarm-skill>/scripts/rank-candidates.mjs --input candidates.json --metric score:max --metric latency_ms:min --json
node <swarm-skill>/scripts/rank-candidates.mjs --input candidates.json --metric score:max --metric latency_ms:min --pareto --json
```

Verify each candidate before setting `status=verified`. The helper trusts that caller-supplied status; it cannot establish correctness from a score. Failed, unverified, and missing-metric records appear separately in `excluded`. Numeric strings, nulls, and nonfinite numbers do not qualify. IDs must be unique.

Without `--pareto`, metric order defines a lexicographic ranking. With it, candidates dominated across all supplied directions are excluded first. Ties sort by ID. Choose the final candidate using its verification evidence and the task's tradeoffs. Keep patch application with the coordinator.

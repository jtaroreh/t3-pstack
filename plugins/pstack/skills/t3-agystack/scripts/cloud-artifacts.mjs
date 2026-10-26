import { lstatSync, existsSync, readdirSync, realpathSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { CloudError, hash } from "./cloud-state.mjs";
const kinds = { "patch.diff": "patch", "score.json": "score", "status.json": "status", "results.tsv": "results" };

export function artifactRoot(record) {
  const slices = join(record.cwd, ".slices"), root = join(slices, record.sessionId);
  for (const path of [slices, root]) if (existsSync(path) && (!lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink())) throw new CloudError("ARTIFACT_PATH", "Artifact directories must be ordinary directories inside the run checkout.");
  if (existsSync(root)) for (const name of readdirSync(root)) {
    const path = join(root, name), stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new CloudError("ARTIFACT_PATH", "Symlinks are not accepted in harvested artifacts.");
    if (stat.isDirectory()) {
      const match = name.match(/^task-(\d+)$/);
      if (!match || Number(match[1]) >= record.plan.tasksCount) throw new CloudError("ARTIFACT_PATH", "Unexpected task directory in harvested artifacts.");
      for (const file of readdirSync(path)) if (lstatSync(join(path, file)).isSymbolicLink()) throw new CloudError("ARTIFACT_PATH", "Symlinks are not accepted in harvested artifacts.");
    }
  }
  return root;
}

export function listArtifacts(record) {
  const root = artifactRoot(record);
  if (!existsSync(root)) return { runId: record.id, harvest: record.harvest?.status ?? "not-started", artifacts: [] };
  const canonical = realpathSync(root), artifacts = [];
  const directories = [[null, root], ...readdirSync(root).filter(name => /^task-\d+$/.test(name) && lstatSync(join(root, name)).isDirectory()).map(name => [Number(name.slice(5)), join(root, name)])];
  for (const [taskIndex, directory] of directories) for (const [name, kind] of Object.entries(kinds)) {
    const path = join(directory, name);
    if (!existsSync(path)) continue;
    const stat = lstatSync(path);
    if (!stat.isFile() || !realpathSync(path).startsWith(canonical + sep)) throw new CloudError("ARTIFACT_PATH", "Artifact is not a regular file inside this run.");
    const tooLarge = stat.size > 64 * 1024 * 1024;
    artifacts.push({ taskIndex, kind, path, bytes: stat.size, sha256: tooLarge ? null : hash(readFileSync(path)), status: tooLarge ? "too-large" : record.state === "succeeded" && record.harvest?.status === "downloaded" ? "unverified" : "quarantined" });
  }
  return { runId: record.id, harvest: record.harvest?.status ?? "not-started", artifacts };
}

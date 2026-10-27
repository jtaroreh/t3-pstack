#!/usr/bin/env node
import { spawn, execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, lstatSync, openSync, mkdirSync, readFileSync, readlinkSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { redact } from "../../t3-agystack/scripts/cloud-state.mjs";

const marker = /\n<!-- pstack-verification (.+) -->\n/;
const hash = value => createHash("sha256").update(value).digest("hex");
const git = (cwd, args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
function fingerprint(cwd) {
  cwd = git(cwd, ["rev-parse", "--show-toplevel"]).trim();
  const parts = [git(cwd, ["rev-parse", "HEAD"]), git(cwd, ["diff", "--binary", "HEAD"])];
  for (const name of git(cwd, ["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean).sort()) {
    const file = resolve(cwd, name); parts.push(name, lstatSync(file).isSymbolicLink() ? readlinkSync(file) : hash(readFileSync(file)));
  }
  return hash(parts.join("\0"));
}
function alive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code !== "ESRCH"; }
}
function groupAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try { process.kill(-pid, 0); return true; } catch (error) { return error.code !== "ESRCH"; }
}
function writePrivate(path, contents) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    const fd = openSync(temporary, "wx", 0o600);
    try { writeFileSync(fd, contents); fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(temporary, path);
    const directory = openSync(dirname(path), "r");
    try { fsyncSync(directory); } finally { closeSync(directory); }
  } finally { if (existsSync(temporary)) unlinkSync(temporary); }
}
let server;
try {
  const { positionals, values: v } = parseArgs({ allowPositionals: true, options: { note: { type: "string" }, cwd: { type: "string" }, verify: { type: "string" }, limit: { type: "string" }, timeout: { type: "string" }, "assert-stopped": { type: "boolean" } } });
  const [verb] = positionals;
  if (positionals.length !== 1 || !["init", "run", "status", "reconcile"].includes(verb) || !v.note) throw Error("usage: verify-task.mjs init --note FILE --cwd DIR --verify COMMAND --limit N [--timeout SECONDS], or run|status --note FILE, or reconcile --note FILE --assert-stopped");
  const note = resolve(v.note);
  if (verb !== "init" && Object.keys(v).some(k => k !== "note" && !(verb === "reconcile" && k === "assert-stopped"))) throw Error("run, status and reconcile accept only their documented options");
  server = createServer();
  await new Promise((ok, fail) => { server.once("error", () => fail(Error("another verifier owns this note or its lock port"))); server.listen(20000 + parseInt(hash(note).slice(0,8),16) % 30000, "127.0.0.1", ok); });
  if (existsSync(note) && !lstatSync(note).isFile()) throw Error("the note must be a regular file");
  let text = existsSync(note) ? readFileSync(note, "utf8") : "";
  const match = text.match(marker);
  let state = match ? JSON.parse(match[1]) : null;
  function save() {
    const block = `\n<!-- pstack-verification ${JSON.stringify(state)} -->\n`;
    text = marker.test(text) ? text.replace(marker, () => block) : text + block;
    mkdirSync(dirname(note), { recursive: true });
    writePrivate(note, text);
  }
  if (verb === "init") {
    if (state) throw Error("the note already has a verification contract; resuming never resets its budget");
    const cwd = resolve(v.cwd ?? process.cwd());
    const root = git(cwd, ["rev-parse", "--show-toplevel"]).trim();
    const gitDir = git(cwd, ["rev-parse", "--absolute-git-dir"]).trim();
    const inside = (base, file) => { const p = relative(base, file); return !isAbsolute(p) && p !== ".." && !p.startsWith("../"); };
    if (inside(root, note) && !inside(gitDir, note)) throw Error("keep the note outside the worktree or inside its Git metadata");
    const limit = Number(v.limit), timeout = Number(v.timeout ?? 120);
    if (!v.verify?.trim() || !Number.isSafeInteger(limit) || limit < 1 || limit > 1000 || !Number.isFinite(timeout) || timeout <= 0 || timeout > 3600) throw Error("supply --verify, --limit 1..1000, and --timeout in (0,3600]");
    state = { version: 1, cwd, verifyCommand: v.verify, limit, timeoutSeconds: timeout, attempts: [] }; save();
  } else {
    if (!state || state.version !== 1 || !Array.isArray(state.attempts)) throw Error("initialize a supported verification contract first");
    const last = state.attempts.at(-1);
    if (verb === "reconcile") {
      if (!v["assert-stopped"] || !last || !["running", "unresolved"].includes(last.outcome)) throw Error("reconcile requires an unresolved attempt and --assert-stopped after inspecting its processes");
      if (alive(last.parentPid) || alive(last.childPid) || groupAlive(last.childPid)) throw Error("known verification processes remain active");
      last.outcome = "interrupted"; last.exitCode = null; last.cleanupComplete = true;
      last.operatorAssertedStoppedAt = new Date().toISOString(); save();
    }
    if (verb === "run") {
      if (last?.outcome === "unresolved") throw Error("previous verification cleanup is unresolved; inspect its processes and reconcile explicitly");
      if (last?.childPid && groupAlive(last.childPid)) throw Error("previous verification process group remains active; reconcile it before another attempt");
      if (last?.outcome === "running") {
        if (alive(last.parentPid) || alive(last.childPid) || !last.childPid) throw Error("previous verification is active or unresolved; reconcile its processes before another run");
        last.outcome = "interrupted"; last.exitCode = null; save();
      }
      if (state.attempts.length >= state.limit) throw Error("verification attempt limit exhausted; the command was not run");
      const before = fingerprint(state.cwd);
      const attempt = { number: state.attempts.length + 1, startedAt: new Date().toISOString(), parentPid: process.pid, childPid: null, outcome: "running", exitCode: null, fingerprint: before };
      state.attempts.push(attempt); save();
      const child = spawn("/bin/sh", ["-c", state.verifyCommand], { cwd: state.cwd, detached: true, stdio: ["ignore", "pipe", "pipe"] });
      let output = "", interrupted = false, timedOut = false, spawnFailed = false, escalation, pipeDeadline, outputAbandoned = false;
      const stop = () => {
        try { process.kill(-child.pid, "SIGTERM"); } catch {}
        escalation ??= setTimeout(() => { try { process.kill(-child.pid,"SIGKILL"); } catch {} }, 500);
        pipeDeadline ??= setTimeout(() => {
          outputAbandoned = true; child.stdout.destroy(); child.stderr.destroy();
        }, 1500);
      };
      const interrupt = () => { interrupted = true; stop(); };
      process.on("SIGINT", interrupt); process.on("SIGTERM", interrupt);
      const timer = setTimeout(() => { timedOut = true; stop(); }, state.timeoutSeconds * 1000);
      const capture = chunk => { output = (output + chunk.toString()).slice(-65536); };
      child.stdout.on("data", capture); child.stderr.on("data", capture); child.on("error", () => { spawnFailed = true; });
      attempt.childPid = child.pid ?? null; save();
      const result = await new Promise(done => child.on("close", (code, signal) => done({ code, signal })));
      clearTimeout(timer);
      if (groupAlive(child.pid)) stop();
      if (escalation) await new Promise(resolve => setTimeout(resolve, 550));
      const cleanupDeadline = Date.now() + 1500;
      while (groupAlive(child.pid) && Date.now() < cleanupDeadline) await new Promise(resolve => setTimeout(resolve, 25));
      attempt.cleanupComplete = !groupAlive(child.pid) && !outputAbandoned;
      clearTimeout(escalation); clearTimeout(pipeDeadline); process.removeListener("SIGINT", interrupt); process.removeListener("SIGTERM", interrupt);
      attempt.exitCode = result.code; attempt.finishedAt = new Date().toISOString();
      attempt.outcome = !attempt.cleanupComplete ? "unresolved" : timedOut ? "timeout" : interrupted || result.signal ? "interrupted" : spawnFailed ? "could not run" : result.code === 0 ? "pass" : "fail";
      attempt.evidence = `${note}.attempt-${attempt.number}.log`;
      writePrivate(attempt.evidence, redact(output));
      try { attempt.current = fingerprint(state.cwd) === before; } catch { attempt.current = false; }
      save();
      process.exitCode = attempt.outcome === "pass" && attempt.current ? 0 : interrupted ? 130 : 1;
    }
  }
  const last = state.attempts.at(-1);
  let current = false; try { current = !!last && fingerprint(state.cwd) === last.fingerprint; } catch {}
  console.log(JSON.stringify({ ...state, current, remaining: state.limit - state.attempts.length, passed: last?.outcome === "pass" && last.current === true && last.cleanupComplete === true && current }));
} catch (error) {
  console.error(JSON.stringify({ error: redact(error.message) })); process.exitCode = 1;
} finally { server?.close(); }

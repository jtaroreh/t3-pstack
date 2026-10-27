import { afterEach, expect, test } from "bun:test";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const cli = fileURLToPath(new URL("../plugins/pstack/skills/poteto-mode/scripts/verify-task.mjs", import.meta.url));
const roots = [];
afterEach(() => roots.splice(0).forEach(p => rmSync(p, { recursive: true, force: true })));
function fixture(command = "test -f fixed", limit = 2, subdir = false) {
  const root = mkdtempSync(join(tmpdir(), "verify-task-")); roots.push(root);
  const git = args => { const p = spawnSync("git", ["-C",root,...args],{encoding:"utf8"}); if(p.status)throw Error(p.stderr); };
  git(["init","-q"]); writeFileSync(join(root,"user.txt"),"keep me"); git(["add","user.txt"]);
  git(["-c","user.name=Test","-c","user.email=test@example.invalid","commit","-qm","initial"]);
  const note = join(root,".git","task.md"); writeFileSync(note,"Existing task constraints\n");
  const run = (args) => spawnSync("node",[cli,...args,"--note",note],{encoding:"utf8",timeout:5000});
  const cwd = subdir ? join(root, "package") : root;
  if (subdir) mkdirSync(cwd);
  expect(run(["init","--cwd",cwd,"--verify",command,"--limit",String(limit),"--timeout","2"]).status).toBe(0);
  return {root,note,run};
}
test("fail, correction, pass, then changed untracked content makes the receipt stale", () => {
  const f=fixture(); expect(f.run(["run"]).status).toBe(1);
  writeFileSync(join(f.root,"fixed"),"yes");
  const second=f.run(["run"]); expect(second.status,second.stderr).toBe(0);
  expect(JSON.parse(second.stdout)).toMatchObject({remaining:0,passed:true});
  writeFileSync(join(f.root,"fixed"),"different");
  expect(JSON.parse(f.run(["status"]).stdout).passed).toBe(false);
  expect(f.run(["run"]).stderr).toContain("limit exhausted");
  expect(readFileSync(f.note,"utf8")).toStartWith("Existing task constraints");
  expect(readFileSync(join(f.root,"user.txt"),"utf8")).toBe("keep me");
});
test("a contract cannot reset its budget and a timeout cannot become pass", () => {
  const f=fixture("sleep 10",1);
  expect(f.run(["init","--cwd",f.root,"--verify","true","--limit","9"]).status).toBe(1);
  expect(f.run(["run"]).status).toBe(1);
  const status=JSON.parse(f.run(["status"]).stdout);
  expect(status.passed).toBe(false); expect(status.attempts).toHaveLength(1);
  expect(status.attempts[0].exitCode).not.toBe(0);
});
test("an interrupted verifier preserves its spent attempt across a new process", async () => {
  const f=fixture("sleep 10",2);
  const p=spawn("node",[cli,"run","--note",f.note],{stdio:"ignore"});
  const done=new Promise(resolve=>p.on("close",resolve));
  const deadline=Date.now()+3000;
  while(!readFileSync(f.note,"utf8").includes('"childPid":') || readFileSync(f.note,"utf8").includes('"childPid":null')) {
    if(Date.now()>deadline)throw Error("verifier did not start"); await new Promise(r=>setTimeout(r,10));
  }
  p.kill("SIGTERM"); await done;
  const status=JSON.parse(f.run(["status"]).stdout);
  expect(status.remaining).toBe(1); expect(status.attempts[0].outcome).toBe("interrupted"); expect(status.passed).toBe(false);
});

test("verification from a subdirectory detects changed untracked files elsewhere in the repository", () => {
  const f = fixture("true", 1, true);
  expect(f.run(["run"]).status).toBe(0);
  writeFileSync(join(f.root, "outside-package.txt"), "changed");
  expect(JSON.parse(f.run(["status"]).stdout).passed).toBe(false);
});
test("a command that changed its tested inputs can never regain a passing receipt", () => {
  const f = fixture("printf B > user.txt; test \"$(cat user.txt)\" = B", 1);
  const run = f.run(["run"]);
  expect(run.status).toBe(1);
  expect(JSON.parse(run.stdout)).toMatchObject({ passed: false, attempts: [{ current: false }] });
  writeFileSync(join(f.root, "user.txt"), "keep me");
  expect(JSON.parse(f.run(["status"]).stdout).passed).toBe(false);
});
test("timeout kills a TERM-resistant background group before another attempt", () => {
  const f = fixture("true", 2);
  const worker = join(f.root, ".git/worker.cjs"), pidFile = join(f.root, ".git/worker.pid");
  writeFileSync(worker, `require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);`);
  let text = readFileSync(f.note, "utf8");
  const match = text.match(/<!-- pstack-verification (.+) -->/);
  const state = JSON.parse(match[1]); state.verifyCommand = `node '${worker}' >/dev/null 2>&1 & wait`; state.timeoutSeconds = 0.3;
  writeFileSync(f.note, text.replace(match[1], JSON.stringify(state)));
  expect(f.run(["run"]).status).toBe(1);
  const pid = Number(readFileSync(pidFile, "utf8"));
  let live = true;
  try { process.kill(pid, 0); } catch (error) { if (error.code === "ESRCH") live = false; }
  expect(live).toBe(false);
  expect(JSON.parse(f.run(["status"]).stdout).passed).toBe(false);
});

test("evidence writes replace symlinks without touching their targets and use private modes", () => {
  const f = fixture("printf receipt", 1);
  const victim = join(f.root, ".git/victim"); writeFileSync(victim, "preserve");
  const evidence = `${f.note}.attempt-1.log`; symlinkSync(victim, evidence);
  expect(f.run(["run"]).status).toBe(0);
  expect(readFileSync(victim, "utf8")).toBe("preserve");
  expect(readFileSync(evidence, "utf8")).toBe("receipt");
  expect(statSync(evidence).mode & 0o777).toBe(0o600);
});
test("unknown child recovery requires an explicit stopped-process assertion without resetting the budget", () => {
  const f = fixture("true", 2);
  let text = readFileSync(f.note, "utf8"); const match = text.match(/<!-- pstack-verification (.+) -->/);
  const prior = spawnSync("node", ["-e", ""], { stdio: "ignore" });
  expect(prior.status).toBe(0); expect(() => process.kill(prior.pid, 0)).toThrow();
  const state = JSON.parse(match[1]); state.attempts.push({ number: 1, outcome: "running", parentPid: process.pid, childPid: null });
  writeFileSync(f.note, text.replace(match[1], JSON.stringify(state)));
  expect(f.run(["run"]).status).toBe(1);
  expect(f.run(["reconcile"]).status).toBe(1);
  expect(f.run(["reconcile", "--assert-stopped"]).stderr).toContain("known verification processes remain active");
  state.attempts[0].parentPid = prior.pid;
  writeFileSync(f.note, text.replace(match[1], JSON.stringify(state)));
  const result = f.run(["reconcile", "--assert-stopped"]);
  expect(result.status, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ remaining: 1, passed: false, attempts: [{ outcome: "interrupted" }] });
  expect(f.run(["run"]).status).toBe(0);
});
test("an escaped descendant holding output pipes cannot hold verification past its termination grace", () => {
  const f = fixture("true", 2);
  const worker = join(f.root, ".git/escape.py"), pidFile = join(f.root, ".git/escaped.pid");
  writeFileSync(worker, `import os,time\nif os.fork(): os._exit(0)\nos.setsid()\nopen(${JSON.stringify(pidFile)},'w').write(str(os.getpid()))\ntime.sleep(60)\n`);
  const text = readFileSync(f.note, "utf8"), match = text.match(/<!-- pstack-verification (.+) -->/), state = JSON.parse(match[1]);
  state.verifyCommand = `python3 '${worker}'`; state.timeoutSeconds = 1;
  writeFileSync(f.note, text.replace(match[1], JSON.stringify(state)));
  try {
    const start = Date.now(), result = f.run(["run"]);
    expect(result.status, result.stderr).toBe(1); expect(Date.now() - start).toBeLessThan(4500);
    expect(JSON.parse(result.stdout)).toMatchObject({ passed: false, attempts: [{ outcome: "unresolved", cleanupComplete: false }] });
    expect(f.run(["run"]).status).toBe(1);
  } finally { if (existsSync(pidFile)) { try { process.kill(Number(readFileSync(pidFile, "utf8")), "SIGKILL"); } catch {} } }
});

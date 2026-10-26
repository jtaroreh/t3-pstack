import { fileURLToPath } from "node:url";
import { CloudError, hash, redact } from "./cloud-state.mjs";
import { executable, parseJson } from "./cloud-process.mjs";
const adapter = fileURLToPath(new URL("./cloud-mailbox.py", import.meta.url));

export async function workerMessage(controller, id, verb, options) {
  const mutation = verb !== "questions";
  const task = options.task;
  const seq = Number(options.seq);
  const text = verb === "steer" ? options.instruction : options.text;
  const request = options["request-id"];
  const record = controller.store.require(id);
  const prefix = `swarms/${record.sessionId}/tasks/`;
  if (!mutation && options.cursor !== undefined && (typeof options.cursor !== "string" || options.cursor.length > 1024 || !options.cursor.startsWith(prefix))) throw new CloudError("INVALID_ARGUMENT", "Question cursor does not belong to this run.");
  if (!record.execution || record.state !== "running") throw new CloudError("RUN_NOT_ACTIVE", "Worker messaging requires a resolved running execution.");
  if (mutation && (typeof text !== "string" || !text.trim() || text.length > 8000 || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(request ?? ""))) throw new CloudError("INVALID_ARGUMENT", "Supply message text and a stable --request-id.");
  if (mutation && !(verb === "steer" && task === "all") && (!/^\d+$/.test(task ?? "") || Number(task) >= record.plan.tasksCount)) throw new CloudError("INVALID_ARGUMENT", "Task index is outside this run.");
  if (verb === "reply" && (!Number.isSafeInteger(seq) || seq < 1)) throw new CloudError("INVALID_ARGUMENT", "Reply requires a positive question --seq.");
  const key = mutation ? hash(request) : null;
  const input = hash(JSON.stringify({ verb, task, seq: verb === "reply" ? seq : null, text }));
  if (mutation) {
    const previous = await controller.store.locked(id, () => {
      const current = controller.store.require(id);
      if (current.state !== "running") throw new CloudError("RUN_NOT_ACTIVE", "The run stopped before message delivery was reserved.");
      current.messages ??= {};
      if (current.messages[key]) {
        if (current.messages[key].input !== input) throw new CloudError("REQUEST_COLLISION", "This message request ID belongs to different inputs.");
        return current.messages[key];
      }
      if (Object.keys(current.messages).length >= 1000) throw new CloudError("MESSAGE_LIMIT", "The run has reached its retained message limit.");
      current.messages[key] = { input, verb, status: "uncertain", requestedAt: new Date().toISOString() };
      controller.save(current); return null;
    });
    if (previous) {
      if (previous.status !== "submitted") throw new CloudError("MESSAGE_UNCERTAIN", "The previous delivery is unresolved. Inspect the mailbox before authorizing a new request ID.");
      return previous.result;
    }
  }
  const args = ["-u", adapter, "--engine", record.engine, "--verb", verb, "--session-id", record.sessionId, "--gcs-bucket", record.plan.gcsBucket, "--max-tasks", String(record.plan.tasksCount)];
  if (!mutation && options.cursor) args.push("--cursor", options.cursor);
  if (mutation) args.push("--task", task, "--text-stdin");
  if (verb === "reply") args.push("--seq", String(seq));
  const result = await controller.external(id, verb, executable("python3"), args, { cwd: record.cwd, ...(mutation ? { input: text } : {}) });
  if (result.code !== 0) throw new CloudError("MAILBOX_FAILED", "The mailbox operation failed. An empty question list or delivery must not be assumed.", { diagnostics: controller.diagnostics(record, verb, result.stderr) });
  const response = parseJson(result.stdout);
  if (!mutation && (!response || !Array.isArray(response.questions) || !(response.nextCursor === null || typeof response.nextCursor === "string" && response.nextCursor.length <= 1024 && response.nextCursor.startsWith(prefix)))) throw new CloudError("MAILBOX_INVALID", "Mailbox returned invalid question pagination.");
  const payload = mutation ? response : response.questions;
  if (!Array.isArray(payload) || payload.length > (verb === "questions" ? 256 : record.plan.tasksCount) || payload.some(item => !item || !Number.isSafeInteger(item.taskIndex) || item.taskIndex < 0 || item.taskIndex >= record.plan.tasksCount || !Number.isSafeInteger(item.seq) || item.seq < 1
    || (verb === "questions" ? typeof item.question !== "string" || item.question.length > 8000 : item.status !== "submitted"))) throw new CloudError("MAILBOX_INVALID", "Mailbox returned an invalid response.");
  if (mutation && (payload.length !== (verb === "steer" && task === "all" ? record.plan.tasksCount : 1)
    || new Set(payload.map(item => item.taskIndex)).size !== payload.length
    || payload.some(item => (task !== "all" && item.taskIndex !== Number(task)) || (verb === "reply" && item.seq !== seq)))) throw new CloudError("MAILBOX_INVALID", "Mailbox acknowledgment does not match the reserved delivery.");
  const safe = payload.map(item => verb === "questions" ? { taskIndex: item.taskIndex, seq: item.seq, question: redact(item.question) } : { taskIndex: item.taskIndex, seq: item.seq, status: "submitted" });
  if (mutation) await controller.store.locked(id, () => {
    const current = controller.store.require(id);
    current.messages[key] = { ...current.messages[key], status: "submitted", result: safe };
    controller.save(current);
  });
  return mutation ? safe : { questions: safe, nextCursor: response.nextCursor };
}

import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadStepContract, validateCompletionEvidence } from "../scripts/lib/acceptance.mjs";
import { importClaudeProgress } from "../scripts/lib/importer.mjs";
import { receiptPath, writeReceiptExclusive } from "../scripts/lib/receipts.mjs";
import { beginStep, completeStep, resumeWorkflow } from "../scripts/lib/workflow.mjs";
import { prepareQuality } from "./helpers/completion-quality.mjs";
import { makeWorkspace, writeClaudeCompletedPrefix } from "./helpers/workspace.mjs";

const pluginRoot = fileURLToPath(new URL("../../", import.meta.url));
const reportId = "routing-integration-report";
const reportPath = "step_archive/step044_routing검증.md";
const legacyId = "html-componentization-report";
const legacyPath = "step_archive/step044_html컴포넌트화.md";

function evidenceFor(contract, { legacy = false, persisted = false } = {}) {
  return contract.acceptance.filter(item => item.required).map(item => {
    const result = { acceptance_id: legacy && item.id === reportId ? legacyId : item.id,
      kind: item.kind, detail: "Recorded routing integration verification", ok: true };
    if (item.kind === "artifact") {
      result.artifact_path = legacy && item.id === reportId ? legacyPath : item.path;
      if (persisted) result.artifact_sha256 = "a".repeat(64);
    }
    if (item.kind === "command") {
      result.command = item.command ?? "npm run build";
      result.exit_code = 0;
    }
    return result;
  });
}

async function materializeReports(root, contract) {
  for (const item of contract.acceptance.filter(item => item.required && item.kind === "artifact")) {
    const path = join(root, item.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, "Recorded routing integration verification\n");
  }
}

test("stored Step 44 report evidence replays without accessing artifact files", async () => {
  const contract = { number: 44, id: "step044", acceptance: [{ id: reportId, kind: "artifact",
    required: true, description: "Routing integration report", path: reportPath }] };
  const persistedEvidence = [{ acceptance_id: legacyId, kind: "artifact", ok: true,
    detail: "Historical routing verification", artifact_path: legacyPath, artifact_sha256: "a".repeat(64) }];
  const result = await validateCompletionEvidence({ contract, evidence: persistedEvidence,
    persistedEvidence, workspaceRoot: await makeWorkspace() });
  assert.deepEqual(result.evidence, persistedEvidence);
});

test("Step 44 recovers an immutable legacy report receipt through the current contract", async () => {
  const workspaceRoot = await makeWorkspace();
  const contract = await loadStepContract(pluginRoot, 44);
  assert.equal(contract.acceptance.find(item => item.id === reportId)?.path, reportPath);
  const persistedEvidence = evidenceFor(contract, { legacy: true, persisted: true });
  await writeClaudeCompletedPrefix(workspaceRoot, 43);
  await importClaudeProgress({ workspaceRoot, pluginRoot });
  const resumed = await resumeWorkflow({ workspaceRoot, sessionId: "routing-legacy-session" });
  const started = await beginStep({ workspaceRoot, step: 44, sessionId: "routing-legacy-session",
    marker: resumed.continuation });
  await writeFile(join(workspaceRoot, legacyPath), "Historical routing report\n");
  await writeReceiptExclusive(workspaceRoot, { schema_version: 1, workflow_id: started.state.workflow_id,
    step: 44, attempt_id: started.attempt.id, provenance: "codex-verified",
    completed_at: new Date().toISOString(), summary: "Historical routing integration verified",
    evidence: persistedEvidence });
  const receiptFile = receiptPath(workspaceRoot, 44);
  const originalBytes = await readFile(receiptFile);
  const evidence = persistedEvidence.map(({ artifact_sha256, ...item }) => item);
  const args = { workspaceRoot, pluginRoot, step: 44, attemptId: started.attempt.id,
    summary: "Historical routing integration verified", evidence };
  const recovered = await completeStep(args);
  assert.equal(recovered.current_step, 45);
  await completeStep(args);
  assert.deepEqual(await readFile(receiptFile), originalBytes);
  assert.equal((await readdir(join(workspaceRoot, "step_archive"))).includes("step044_routing검증.md"), false);
  assert.equal(await readFile(join(workspaceRoot, legacyPath), "utf8"), "Historical routing report\n");
  await assert.rejects(completeStep({ ...args, evidence: evidence.map(item => item.acceptance_id === legacyId
    ? { ...item, detail: "A different verification claim" } : item) }), error => error.code === "RECEIPT_CONFLICT");
  assert.deepEqual(await readFile(receiptFile), originalBytes);
});

test("legacy report replay retains the exact old ID/path pair and all routing gates", async () => {
  const contract = await loadStepContract(pluginRoot, 44);
  const workspaceRoot = await makeWorkspace();
  const old = evidenceFor(contract, { legacy: true, persisted: true });
  const cases = [
    [old.map(item => item.acceptance_id === legacyId ? { ...item, artifact_path: reportPath } : item), "ACCEPTANCE_ARTIFACT_PATH"],
    [old.map(item => item.acceptance_id === legacyId ? { ...item, artifact_path: "../outside.md" } : item), "ACCEPTANCE_ARTIFACT_PATH"],
    [old.map(item => item.acceptance_id === legacyId ? { ...item, acceptance_id: reportId } : item), "ACCEPTANCE_ARTIFACT_PATH"],
    [[...old, { ...old[0], acceptance_id: reportId, artifact_path: reportPath }], "ACCEPTANCE_UNKNOWN"],
    [[...old, old[0]], "ACCEPTANCE_DUPLICATE"],
    [old.map(item => item.acceptance_id === legacyId ? { ...item, kind: "check" } : item), "ACCEPTANCE_KIND_MISMATCH"],
    [old.map(item => item.acceptance_id === "routing-native-behavior" ? { ...item, ok: false } : item), "ACCEPTANCE_MISSING"],
    [old.filter(item => item.acceptance_id !== "routing-deep-link-traversal"), "ACCEPTANCE_MISSING"]
  ];
  for (const [evidence, code] of cases) {
    await assert.rejects(validateCompletionEvidence({ contract, workspaceRoot,
      evidence, persistedEvidence: evidence }), error => error.code === code);
  }
});

test("legacy report replay cannot change or omit the durable report digest", async () => {
  const contract = await loadStepContract(pluginRoot, 44);
  const workspaceRoot = await makeWorkspace();
  const persistedEvidence = evidenceFor(contract, { legacy: true, persisted: true });
  const changed = persistedEvidence.map(item => item.acceptance_id === legacyId
    ? { ...item, artifact_sha256: "b".repeat(64) } : item);
  await assert.rejects(validateCompletionEvidence({ contract, workspaceRoot,
    evidence: changed, persistedEvidence }), error => error.code === "RECEIPT_CONFLICT");
  const missing = persistedEvidence.map(({ artifact_sha256, ...item }) => item);
  await assert.rejects(validateCompletionEvidence({ contract, workspaceRoot,
    evidence: missing, persistedEvidence: missing }), error => error.code === "RECEIPT_CONFLICT");
});

test("new Step 44 completion only accepts the canonical report and current measured quality", async () => {
  const contract = await loadStepContract(pluginRoot, 44);
  const workspaceRoot = await makeWorkspace();
  const evidence = evidenceFor(contract);
  await materializeReports(workspaceRoot, contract);
  await assert.rejects(validateCompletionEvidence({ contract, workspaceRoot, evidence }),
    error => error.code === "ACCEPTANCE_QUALITY_INCOMPLETE");
  await prepareQuality(workspaceRoot);
  const result = await validateCompletionEvidence({ contract, workspaceRoot, evidence });
  assert.equal(result.evidence.find(item => item.acceptance_id === reportId)?.artifact_path, reportPath);
  assert.match(result.evidence.find(item => item.acceptance_id === reportId)?.artifact_sha256, /^[a-f0-9]{64}$/);
  assert.equal(result.evidence.some(item => item.acceptance_id === "measured-quality-report" && item.ok), true);
  assert.equal((await readdir(join(workspaceRoot, "step_archive"))).includes("step044_html컴포넌트화.md"), false);
  await writeFile(join(workspaceRoot, "app.js"), "Changed application source\n");
  await assert.rejects(validateCompletionEvidence({ contract, workspaceRoot, evidence }),
    error => error.code === "ACCEPTANCE_QUALITY_INCOMPLETE");
});

test("new completions and unrelated steps cannot opt into the legacy report alias", async () => {
  const contract = await loadStepContract(pluginRoot, 44);
  const workspaceRoot = await makeWorkspace();
  const old = evidenceFor(contract, { legacy: true, persisted: true });
  await assert.rejects(validateCompletionEvidence({ contract, workspaceRoot, evidence: old }),
    error => error.code === "ACCEPTANCE_UNKNOWN");
  await assert.rejects(validateCompletionEvidence({ contract: { ...contract, number: 43 }, workspaceRoot,
    evidence: old, persistedEvidence: old }), error => error.code === "ACCEPTANCE_UNKNOWN");
});

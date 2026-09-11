import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { handleStop } from "../hooks/stop.mjs";
import { handleUserPromptSubmit } from "../hooks/user-prompt-submit.mjs";
import { beginStep, completeStep, initWorkflow, showWorkflow } from "../scripts/lib/workflow.mjs";
import { readState } from "../scripts/lib/state-store.mjs";
import { readReceipts } from "../scripts/lib/receipts.mjs";
import { makePluginFixture, makeWorkspace } from "./helpers/workspace.mjs";
import { prepareSchedulerMilestone } from "./helpers/completion-quality.mjs";

// These are real scheduler/hook operations with isolated acceptance fixtures.
// This does not claim that an actual product or live host completed 50 steps.
test("one short request supports all 50 verified handoffs without another human request", async () => {
  const workspaceRoot = await makeWorkspace();
  const pluginRoot = await makePluginFixture();
  let tick = Date.parse("2026-09-11T00:00:00.000Z");
  const now = () => new Date(tick++).toISOString();
  const request = "Replace Inline Code with Function Call을 체험하는 게임";
  let state = await initWorkflow({ workspaceRoot, topic: request, now: now() });
  const topic = await readFile(join(workspaceRoot, "step_archive/TOPIC/TOPIC.md"), "utf8");
  for (const field of ["topic", "audience", "interactive", "real_world_apps", "constraints", "decisions"]) {
    assert.match(topic, new RegExp(`^## ${field}\\s*$`, "m"));
  }
  assert.ok(topic.includes(request));

  let handoffs = 0;
  for (let step = 1; step <= 50; step++) {
    assert.equal(state.current_step, step);
    const begun = await beginStep({ workspaceRoot, step, marker: state.continuation, now: now() });
    await prepareSchedulerMilestone(workspaceRoot, step);
    state = await completeStep({
      workspaceRoot, pluginRoot, step, attemptId: begun.attempt.id, now: now(),
      summary: `Isolated scheduler fixture step ${step}`,
      evidence: [{ acceptance_id: "state-transition", kind: "check", ok: true, detail: "Isolated transition fixture verified" }]
    });
    const stop = await handleStop({ turn_id: `autopilot-${step}`, stop_hook_active: step > 1 }, {
      workspaceRoot, eventNow: now()
    });
    if (step === 50) {
      assert.deepEqual(stop, {});
      break;
    }
    assert.equal(stop.decision, "block");
    assert.equal(stop.reason, `[HARNESS50_CONTINUE ${JSON.stringify(state.continuation)}]`);
    assert.deepEqual(await handleUserPromptSubmit({ prompt: stop.reason }, {
      workspaceRoot, eventNow: now()
    }), {});
    state = await readState(workspaceRoot);
    assert.equal(state.status, "running");
    assert.equal(state.stop_delivery.accepted, true);
    handoffs++;
  }

  const status = await showWorkflow({ workspaceRoot });
  assert.equal(handoffs, 49);
  assert.equal(status.status, "completed");
  assert.equal(status.current_step, null);
  assert.equal(status.completed_count, 50);
  assert.equal(status.continuation_available, false);
  assert.equal((await readReceipts(workspaceRoot)).length, 50);
  assert.equal(await readFile(join(workspaceRoot, "step_archive/TOPIC/TOPIC.md"), "utf8"), topic);
});

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { baseRef, clipDiff, commentDestination, reviewDecision, reviewPrompt } from "./ai-review.mjs";

const scriptPath = new URL("./ai-review.mjs", import.meta.url);

describe("ai review", () => {
  it("skips when the key is missing and reviews when it is set", () => {
    assert.equal(reviewDecision({}).action, "skip");
    assert.equal(reviewDecision({ XAI_API_KEY: "  " }).action, "skip");
    assert.equal(reviewDecision({ XAI_API_KEY: "xai-test" }).action, "review");
  });

  it("exits 0 when XAI_API_KEY is missing", () => {
    const env = { ...process.env };
    delete env.XAI_API_KEY;
    const result = spawnSync(process.execPath, [scriptPath.pathname], {
      encoding: "utf8",
      env,
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /AI review skipped: XAI_API_KEY is not set/);
  });

  it("clips a huge diff and keeps a short one", () => {
    assert.equal(clipDiff("small"), "small");
    const huge = "a".repeat(20_000);
    const clipped = clipDiff(huge);
    assert.equal(clipped.endsWith("[diff truncated]"), true);
    assert.equal(clipped.length < huge.length, true);
  });

  it("prints locally when the pull request or Origin CLI is missing", () => {
    assert.equal(commentDestination({}), "stdout");
    assert.equal(commentDestination({ PR_NUMBER: "8" }, false), "stdout");
    assert.equal(commentDestination({ PR_NUMBER: "8" }), "origin");
    assert.equal(
      commentDestination({ PR_NUMBER: "8", GITHUB_TOKEN: "ghs", GITHUB_REPOSITORY: "Phazzie/llm-council" }),
      "origin",
    );
  });

  it("diffs against master unless the workflow sets a base ref", () => {
    assert.equal(baseRef({}), "master");
    assert.equal(baseRef({ GITHUB_BASE_REF: "release" }), "release");
    assert.equal(baseRef({ BASE_REF: "topic" }), "topic");
  });

  it("asks for bugs rather than style notes", () => {
    const prompt = reviewPrompt("diff --git a/backend/council.py");
    assert.match(prompt, /security|secrets|council/i);
    assert.match(prompt, /diff --git a\/backend\/council.py/);
  });
});

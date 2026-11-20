import test from "node:test";
import assert from "node:assert/strict";
import { claimNextJob, completeJob, failJob, renewJobLease } from "./worker-queue.js";

const forbiddenPool = {
  async connect() {
    throw new Error("Database must not be touched for invalid input");
  }
};

test("worker lease duration is bounded before database access", async () => {
  await assert.rejects(claimNextJob(forbiddenPool, { leaseSeconds: 1 }), TypeError);
  await assert.rejects(renewJobLease(forbiddenPool, {
    jobId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    leaseToken: "A".repeat(43)
  }, { leaseSeconds: 301 }), TypeError);
});

test("lease operations reject malformed IDs and opaque tokens", async () => {
  await assert.rejects(completeJob(forbiddenPool, {
    jobId: "../other-tenant",
    leaseToken: "A".repeat(43)
  }), /identifier/i);
  await assert.rejects(completeJob(forbiddenPool, {
    jobId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    leaseToken: "not-a-lease"
  }), /lease token/i);
});

test("retry failure codes are machine-readable and bounded", async () => {
  const lease = {
    jobId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    leaseToken: "A".repeat(43)
  };
  await assert.rejects(failJob(forbiddenPool, lease, { errorCode: "shell command failed" }), /errorCode/);
  await assert.rejects(failJob(forbiddenPool, lease, { retryBaseSeconds: 0 }), /retryBaseSeconds/);
});

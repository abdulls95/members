import test from "node:test";
import assert from "node:assert/strict";
import { EgressPolicyError, normalizeEgressHostname, validateResolvedAddresses } from "./egress-policy.js";

test("normalizes DNS hostnames and rejects URL syntax or IP literals", () => {
  assert.equal(normalizeEgressHostname("WWW.Example.com."), "www.example.com");
  for (const value of ["localhost", "127.0.0.1", "https://example.com", "user@example.com", "a..b.com", "*.example.com", "example.com:443"]) {
    assert.throws(() => normalizeEgressHostname(value), EgressPolicyError);
  }
});

test("accepts public IPv4 and global unicast IPv6 answers", () => {
  const result = validateResolvedAddresses("example.com", ["93.184.216.34", "2606:4700:4700::1111"]);
  assert.deepEqual(result.addresses.map(item => item.family), [4, 6]);
});

test("fails closed when any DNS answer is private, local or reserved", () => {
  for (const address of [
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1",
    "169.254.169.254", "100.64.0.1", "198.18.0.1", "224.0.0.1",
    "::", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1",
    "ff02::1", "2001:db8::1", "2002::1", "3fff::1"
  ]) {
    assert.throws(() => validateResolvedAddresses("example.com", [address]), EgressPolicyError, address);
  }
});

test("rejects mixed public/private DNS answers rather than selecting a public one", () => {
  assert.throws(() => validateResolvedAddresses("example.com", ["93.184.216.34", "10.0.0.2"]), {
    code: "EGRESS_DESTINATION_BLOCKED"
  });
});

test("rejects empty, excessive and malformed DNS responses", () => {
  assert.throws(() => validateResolvedAddresses("example.com", []), { code: "EGRESS_DNS_RESULT_INVALID" });
  assert.throws(() => validateResolvedAddresses("example.com", Array(33).fill("93.184.216.34")), { code: "EGRESS_DNS_RESULT_INVALID" });
  assert.throws(() => validateResolvedAddresses("example.com", ["not-an-ip"]), { code: "EGRESS_DNS_RESULT_INVALID" });
});

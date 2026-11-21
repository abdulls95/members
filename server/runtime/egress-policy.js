import net from "node:net";
import { domainToASCII } from "node:url";

const ipv4Denied = new net.BlockList();
for (const [subnet, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
  ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]
]) ipv4Denied.addSubnet(subnet, prefix, "ipv4");

const ipv6Denied = new net.BlockList();
for (const [subnet, prefix] of [
  ["::", 128], ["::1", 128], ["::ffff:0:0", 96],
  ["64:ff9b:1::", 48], ["100::", 64], ["2001::", 23],
  ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]
]) ipv6Denied.addSubnet(subnet, prefix, "ipv6");

const ipv6GlobalUnicast = new net.BlockList();
ipv6GlobalUnicast.addSubnet("2000::", 3, "ipv6");

const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export class EgressPolicyError extends Error {
  constructor(code) {
    super(code);
    this.name = "EgressPolicyError";
    this.code = code;
  }
}

/** Normalize a DNS hostname. IP literals are handled only after DNS resolution. */
export function normalizeEgressHostname(input) {
  if (typeof input !== "string" || input.length < 1 || input.length > 253 ||
      input.includes("/") || input.includes("@") || input.includes(":") ||
      input.includes("\\") || input.includes("%") || input.includes("*")) {
    throw new EgressPolicyError("EGRESS_HOST_INVALID");
  }
  const hostname = domainToASCII(input.replace(/\.$/, "").toLowerCase());
  if (!hostname || hostname.length > 253 || net.isIP(hostname) ||
      !hostname.includes(".") || hostname.split(".").some(label => !HOST_LABEL.test(label))) {
    throw new EgressPolicyError("EGRESS_HOST_INVALID");
  }
  return hostname;
}

/**
 * Validate every A/AAAA answer obtained immediately before connection.
 * The broker must connect to one of these exact validated addresses (not
 * resolve the hostname again), preserve TLS SNI/Host, and repeat validation
 * after every redirect. This helper is policy logic, not a network firewall.
 */
export function validateResolvedAddresses(hostnameInput, addresses) {
  const hostname = normalizeEgressHostname(hostnameInput);
  if (!Array.isArray(addresses) || addresses.length < 1 || addresses.length > 32) {
    throw new EgressPolicyError("EGRESS_DNS_RESULT_INVALID");
  }

  const normalized = [];
  for (const address of addresses) {
    if (typeof address !== "string") throw new EgressPolicyError("EGRESS_DNS_RESULT_INVALID");
    const family = net.isIP(address);
    if (family === 4) {
      if (ipv4Denied.check(address, "ipv4")) throw new EgressPolicyError("EGRESS_DESTINATION_BLOCKED");
    } else if (family === 6) {
      if (!ipv6GlobalUnicast.check(address, "ipv6") || ipv6Denied.check(address, "ipv6")) {
        throw new EgressPolicyError("EGRESS_DESTINATION_BLOCKED");
      }
    } else {
      throw new EgressPolicyError("EGRESS_DNS_RESULT_INVALID");
    }
    normalized.push(Object.freeze({ address, family }));
  }

  return Object.freeze({ hostname, addresses: Object.freeze(normalized) });
}

import { describe, expect, test } from "bun:test";
import {
  connectorAttemptStatusValues,
  connectorBindingStatusValues,
  connectorInboxStatusValues,
  connectorServiceIdentityStatusValues,
  connectorSignatureAlgorithmValues,
  connectorSignaturePayload,
  defineConnectorManifest,
  isConnectorEnvelope,
} from "../src/index.js";

const validEnvelope = () => ({
  schemaVersion: 1 as const,
  connectorId: "telemetry-adapter",
  connectorVersion: "1.2.0",
  eventId: "evt-0001",
  upstreamIdentity: "sensor:alpha:0001",
  eventType: "signal.observed",
  occurredAt: "2026-08-21T18:00:00.000Z",
  payload: { measurement: { value: 12.5, unit: "bar" }, tags: ["lab"] },
});

describe("connector contracts", () => {
  test("freezes a versioned manifest with unique event identities", () => {
    const manifest = defineConnectorManifest({
      id: "telemetry-adapter",
      name: "Telemetry Adapter",
      version: "1.2.0",
      events: [
        { direction: "inbound", name: "Signal observed", schemaVersion: 1, type: "signal.observed" },
        { direction: "outbound", name: "Action accepted", schemaVersion: 1, type: "action.accepted" },
      ],
    });
    expect(Object.isFrozen(manifest)).toBe(true);
    expect(Object.isFrozen(manifest.events)).toBe(true);
    expect(manifest.events.map(({ direction, type }) => [direction, type])).toEqual([
      ["inbound", "signal.observed"],
      ["outbound", "action.accepted"],
    ]);
    expect(() => defineConnectorManifest({ ...manifest, events: [manifest.events[0]!, manifest.events[0]!] })).toThrow("duplicated");
  });

  test("accepts only an exact bounded version-one envelope", () => {
    const valid = validEnvelope();
    expect(isConnectorEnvelope(valid)).toBe(true);
    expect(isConnectorEnvelope({ ...valid, extra: true })).toBe(false);
    expect(isConnectorEnvelope({ ...valid, connectorVersion: "latest" })).toBe(false);
    expect(isConnectorEnvelope({ ...valid, eventId: " x " })).toBe(false);
    expect(isConnectorEnvelope({ ...valid, payload: null })).toBe(false);
    expect(isConnectorEnvelope({ ...valid, occurredAt: "2026-08-21" })).toBe(false);
  });

  test("rejects dangerous, too deep, too wide and oversized payloads", () => {
    const dangerous = JSON.parse('{"__proto__":{"polluted":true}}');
    expect(isConnectorEnvelope({ ...validEnvelope(), payload: dangerous })).toBe(false);

    let deep: Record<string, unknown> = { value: true };
    for (let index = 0; index < 20; index += 1) deep = { nested: deep };
    expect(isConnectorEnvelope({ ...validEnvelope(), payload: deep })).toBe(false);

    const wide = Object.fromEntries(Array.from({ length: 600 }, (_, index) => [`key${index}`, index]));
    expect(isConnectorEnvelope({ ...validEnvelope(), payload: wide })).toBe(false);
    expect(isConnectorEnvelope({ ...validEnvelope(), payload: { value: "x".repeat(70_000) } })).toBe(false);
  });

  test("domain-separates exact signature bytes and rejects delimiter injection", () => {
    const text = new TextDecoder().decode(
      connectorSignaturePayload({ bindingId: "binding-0001", keyId: "key-2026-01", body: '{"eventId":"evt-1"}' }),
    );
    expect(text).toBe(["connector-contracts-v1", "binding-0001", "key-2026-01", '{"eventId":"evt-1"}'].join(String.fromCharCode(10)));
    const newline = String.fromCharCode(10);
    expect(() => connectorSignaturePayload({ bindingId: `binding${newline}injected`, keyId: "key", body: "{}" })).toThrow("bindingId");
    expect(() => connectorSignaturePayload({ bindingId: "binding", keyId: `key${newline}injected`, body: "{}" })).toThrow("keyId");
  });

  test("exports bounded lifecycle vocabularies", () => {
    expect(connectorBindingStatusValues).toEqual(["disabled", "active"]);
    expect(connectorServiceIdentityStatusValues).toEqual(["active", "revoked"]);
    expect(connectorInboxStatusValues).toEqual(["pending", "processing", "succeeded", "dead"]);
    expect(connectorAttemptStatusValues).toEqual(["processing", "succeeded", "retry_scheduled", "dead"]);
    expect(connectorSignatureAlgorithmValues).toEqual(["hmac-sha256", "ed25519"]);
  });
});

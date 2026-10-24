export const connectorBindingStatusValues = ["disabled", "active"] as const;
export type ConnectorBindingStatus = (typeof connectorBindingStatusValues)[number];

export const connectorServiceIdentityStatusValues = ["active", "revoked"] as const;
export type ConnectorServiceIdentityStatus = (typeof connectorServiceIdentityStatusValues)[number];

export const connectorInboxStatusValues = ["pending", "processing", "succeeded", "dead"] as const;
export type ConnectorInboxStatus = (typeof connectorInboxStatusValues)[number];

export const connectorAttemptStatusValues = ["processing", "succeeded", "retry_scheduled", "dead"] as const;
export type ConnectorAttemptStatus = (typeof connectorAttemptStatusValues)[number];

export const connectorSignatureAlgorithmValues = ["hmac-sha256", "ed25519"] as const;
export type ConnectorSignatureAlgorithm = (typeof connectorSignatureAlgorithmValues)[number];

export const connectorEventDirectionValues = ["inbound", "outbound"] as const;
export type ConnectorEventDirection = (typeof connectorEventDirectionValues)[number];

export interface ConnectorEventManifest {
  direction: ConnectorEventDirection;
  name: string;
  schemaVersion: 1;
  type: string;
}

export interface ConnectorManifest {
  id: string;
  name: string;
  version: string;
  events: readonly Readonly<ConnectorEventManifest>[];
}

export interface ConnectorEnvelope {
  schemaVersion: 1;
  connectorId: string;
  connectorVersion: string;
  eventId: string;
  upstreamIdentity: string;
  eventType: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface ConnectorPayloadLimits {
  maxDepth: number;
  maxEncodedBytes: number;
  maxKeys: number;
  maxNodes: number;
  maxStringLength: number;
}

export const defaultConnectorPayloadLimits: Readonly<ConnectorPayloadLimits> = Object.freeze({
  maxDepth: 16,
  maxEncodedBytes: 65_536,
  maxKeys: 512,
  maxNodes: 4_096,
  maxStringLength: 16_384,
});

const connectorIdPattern = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/u;
const connectorVersionPattern = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?$/u;
const eventTypePattern = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/u;
const occurredAtPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;
const forbiddenPayloadKeys = new Set(["__proto__", "constructor", "prototype"]);
const envelopeKeys = [
  "schemaVersion",
  "connectorId",
  "connectorVersion",
  "eventId",
  "upstreamIdentity",
  "eventType",
  "occurredAt",
  "payload",
] as const;

const hasControlCharacter = (value: string): boolean =>
  [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f);
  });

export const isConnectorOpaqueIdentity = (value: unknown, maximumLength: number): value is string =>
  typeof value === "string" &&
  value.length >= 1 &&
  value.length <= maximumLength &&
  value === value.trim() &&
  !hasControlCharacter(value);

export const isConnectorId = (value: unknown): value is string => typeof value === "string" && connectorIdPattern.test(value);
export const isConnectorVersion = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 64 && connectorVersionPattern.test(value);
export const isConnectorEventType = (value: unknown): value is string => typeof value === "string" && eventTypePattern.test(value);

const assertDisplayName = (value: string, label: string): void => {
  if (value !== value.trim() || value.length < 1 || value.length > 100 || hasControlCharacter(value)) {
    throw new Error(`${label} is invalid`);
  }
};

export const defineConnectorManifest = (input: {
  id: string;
  name: string;
  version: string;
  events: readonly ConnectorEventManifest[];
}): Readonly<ConnectorManifest> => {
  if (!isConnectorId(input.id)) throw new Error("Connector id is invalid");
  if (!isConnectorVersion(input.version)) throw new Error("Connector version is invalid");
  assertDisplayName(input.name, "Connector name");
  if (input.events.length < 1 || input.events.length > 100) throw new Error("Connector event catalog is invalid");

  const eventTypes = new Set<string>();
  const events = input.events.map((event) => {
    if (!connectorEventDirectionValues.includes(event.direction)) throw new Error("Connector event direction is invalid");
    if (!isConnectorEventType(event.type)) throw new Error("Connector event type is invalid");
    if (eventTypes.has(event.type)) throw new Error("Connector event identity is duplicated");
    assertDisplayName(event.name, "Connector event name");
    if (event.schemaVersion !== 1) throw new Error("Connector event schema version is invalid");
    eventTypes.add(event.type);
    return Object.freeze({ ...event });
  });

  return Object.freeze({ id: input.id, name: input.name, version: input.version, events: Object.freeze(events) });
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

interface PayloadState {
  keys: number;
  nodes: number;
  ancestors: Set<object>;
}

const isBoundedJson = (value: unknown, depth: number, limits: ConnectorPayloadLimits, state: PayloadState): boolean => {
  state.nodes += 1;
  if (state.nodes > limits.maxNodes || depth > limits.maxDepth) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.length <= limits.maxStringLength && !hasControlCharacter(value);

  if (Array.isArray(value)) {
    if (Object.hasOwn(value, "toJSON") || state.ancestors.has(value)) return false;
    state.ancestors.add(value);
    try {
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, index);
        if (!descriptor || descriptor.get || descriptor.set || !isBoundedJson(descriptor.value, depth + 1, limits, state)) return false;
      }
      return true;
    } finally {
      state.ancestors.delete(value);
    }
  }

  if (!isPlainRecord(value) || Object.hasOwn(value, "toJSON") || state.ancestors.has(value)) return false;
  state.ancestors.add(value);
  try {
    for (const key of Object.keys(value)) {
      state.keys += 1;
      if (state.keys > limits.maxKeys || forbiddenPayloadKeys.has(key) || hasControlCharacter(key) || key.length > 200) return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || descriptor.get || descriptor.set || !isBoundedJson(descriptor.value, depth + 1, limits, state)) return false;
    }
    return true;
  } finally {
    state.ancestors.delete(value);
  }
};

export const isConnectorPayload = (
  value: unknown,
  limits: ConnectorPayloadLimits = defaultConnectorPayloadLimits,
): value is Record<string, unknown> => {
  if (!isPlainRecord(value)) return false;
  const state: PayloadState = { ancestors: new Set(), keys: 0, nodes: 0 };
  if (!isBoundedJson(value, 0, limits, state)) return false;
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength <= limits.maxEncodedBytes;
  } catch {
    return false;
  }
};

export const isConnectorEnvelope = (
  value: unknown,
  limits: ConnectorPayloadLimits = defaultConnectorPayloadLimits,
): value is ConnectorEnvelope => {
  if (!isPlainRecord(value) || Object.keys(value).length !== envelopeKeys.length || envelopeKeys.some((key) => !Object.hasOwn(value, key))) {
    return false;
  }
  if (envelopeKeys.some((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return !descriptor || descriptor.get !== undefined || descriptor.set !== undefined;
  })) return false;
  if (value.schemaVersion !== 1) return false;
  if (!isConnectorId(value.connectorId) || !isConnectorVersion(value.connectorVersion)) return false;
  if (!isConnectorOpaqueIdentity(value.eventId, 200) || !isConnectorOpaqueIdentity(value.upstreamIdentity, 300)) return false;
  if (!isConnectorEventType(value.eventType)) return false;
  if (typeof value.occurredAt !== "string" || value.occurredAt.length > 40 || !occurredAtPattern.test(value.occurredAt)) return false;
  const occurredAtMillis = Date.parse(value.occurredAt);
  if (!Number.isFinite(occurredAtMillis) || new Date(occurredAtMillis).toISOString().slice(0, 19) !== value.occurredAt.slice(0, 19)) return false;
  return isConnectorPayload(value.payload, limits);
};

const assertSignatureIdentity = (value: string, label: "bindingId" | "keyId"): void => {
  if (!isConnectorOpaqueIdentity(value, 200)) throw new Error(`${label} is invalid`);
};

export const connectorSignaturePayload = (input: { bindingId: string; keyId: string; body: string }): Uint8Array => {
  assertSignatureIdentity(input.bindingId, "bindingId");
  assertSignatureIdentity(input.keyId, "keyId");
  if (new TextEncoder().encode(input.body).byteLength > 1_048_576) throw new Error("body is too large");
  return new TextEncoder().encode(["connector-contracts-v1", input.bindingId, input.keyId, input.body].join(String.fromCharCode(10)));
};

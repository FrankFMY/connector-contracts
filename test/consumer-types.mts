import { defineConnectorManifest, connectorSignaturePayload, isConnectorEnvelope } from "@frankfmy/connector-contracts";
import type { ConnectorEnvelope } from "@frankfmy/connector-contracts";
const unknownValue: unknown = {};
if (isConnectorEnvelope(unknownValue)) { const typed: ConnectorEnvelope = unknownValue; void typed; }
const bytes: Uint8Array = connectorSignaturePayload({ bindingId: "a", keyId: "b", body: "{}" });
// @ts-expect-error signature bytes are not strings
const invalid: string = bytes;
// @ts-expect-error manifest event schema version must be one
defineConnectorManifest({ id: "a", name: "A", version: "1.0.0", events: [{ direction: "inbound", name: "X", type: "x", schemaVersion: 2 }] });
void invalid;

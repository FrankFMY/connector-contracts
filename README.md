# Connector Contracts

Strict versioned connector manifests, event envelopes, payload limits, lifecycle vocabularies, and domain-separated signature bytes for TypeScript.

I built this package for integration boundaries where an event must be rejected before persistence unless its identity, version, timestamp, payload shape, and signing context are exact and bounded.

## Capabilities

- immutable connector manifests;
- semantic-version connector identities;
- unique inbound/outbound event catalogs;
- strict version-one envelopes with exact keys;
- bounded identifiers and RFC 3339 UTC timestamps;
- finite JSON-only payload validation;
- depth, node, key, string, and encoded-byte limits;
- cycle, accessor, sparse-array, class-instance, and prototype-key rejection;
- HMAC-SHA256 and Ed25519 algorithm vocabulary;
- domain-separated signature payload bytes;
- bounded inbox/attempt lifecycle vocabularies.

## Manifest

```ts
import { defineConnectorManifest } from "@frankfmy/connector-contracts";

const manifest = defineConnectorManifest({
  id: "telemetry-adapter",
  name: "Telemetry Adapter",
  version: "1.2.0",
  events: [
    {
      direction: "inbound",
      name: "Signal observed",
      schemaVersion: 1,
      type: "signal.observed",
    },
  ],
});
```

The returned manifest and event array are frozen. Event type identities must be unique.

## Envelope validation

```ts
import { isConnectorEnvelope } from "@frankfmy/connector-contracts";

if (!isConnectorEnvelope(input)) {
  throw new Error("invalid connector envelope");
}
```

Default payload limits:

| Limit | Value |
|---|---:|
| Encoded JSON | 65,536 bytes |
| Depth | 16 |
| Object keys | 512 |
| Nodes | 4,096 |
| String length | 16,384 characters |

A caller may provide a different complete `ConnectorPayloadLimits` policy. Supply finite non-negative integer limits. Validators accept inert JSON-shaped data, not proxies or globally modified built-in prototypes. Accessor-backed envelope/array properties and own `toJSON` hooks (including hidden hooks) are rejected without invocation. The timestamp contract is four-digit-year UTC calendar dates with optional 1–3 fractional-second digits; leap seconds are not supported.

## Signature bytes

```ts
import { connectorSignaturePayload } from "@frankfmy/connector-contracts";

const bytes = connectorSignaturePayload({
  bindingId: "binding-0001",
  keyId: "key-2026-01",
  body: exactRequestBody,
});
```

The resulting byte sequence is:

```text
connector-contracts-v1
<binding-id>
<key-id>
<exact-body>
```

Binding and key identities reject whitespace/control-character delimiter injection. Cryptographic signing and verification remain caller-owned.

## Security boundary

This package validates contracts; it does not provide transport authentication, replay persistence, key custody, lease processing, tenant authorization, retries, or dead-letter storage. See [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md).

## Package status

The npm release is pending maintainer approval. [npm package](https://www.npmjs.com/package/@frankfmy/connector-contracts) · [source](https://github.com/FrankFMY/connector-contracts). ESM, Node.js 20+ or Bun 1.4+; no runtime dependencies.

```bash
npm install @frankfmy/connector-contracts
```

Until npm approval, use the source checkout below, run `bun run build` and `npm pack`, and install the resulting tarball. Automatic release-triggered registry publication is not enabled.

## Development

```bash
git clone https://github.com/FrankFMY/connector-contracts.git
cd connector-contracts
bun install --frozen-lockfile
bun run verify
```

## Author

**Artem Prianishnikov**

- GitHub: https://github.com/FrankFMY
- Website: https://frankfmy.com
- Email: Pryanishnikovartem@gmail.com · frankfmy@proton.me
- Telegram: https://t.me/FrankFMY
- LinkedIn: https://www.linkedin.com/in/frankfmy/
- X: https://x.com/FrankFMY
- npm: https://www.npmjs.com/~frankfmy

## License

Apache-2.0 © 2026 Artem Prianishnikov. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

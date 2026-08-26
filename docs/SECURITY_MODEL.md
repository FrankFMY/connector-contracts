# Security Model

## Trust boundary

Every connector payload is untrusted input. Validation must happen before event admission, signature acceptance, handler dispatch, audit persistence, or retry scheduling.

## What this package proves

- manifest identifiers and versions match bounded grammars;
- event identities are unique inside a manifest;
- envelope keys are exact and schema version is supported;
- opaque identities contain no leading/trailing whitespace or control delimiters;
- timestamps use the accepted UTC wire grammar and parse to a finite instant;
- payloads are finite JSON values within explicit resource limits;
- signature input is domain-separated by protocol, binding, and key identity.

## What remains application-owned

- verify signatures with securely held keys;
- bind the service identity to the exact connector and tenant/scope;
- persist event ID and upstream identity uniqueness transactionally;
- reject response-loss replays with changed bytes;
- fence leased workers with owner tokens;
- revalidate authorization before execution;
- bound attempts, backoff, stale-claim recovery, dead letters, and manual replay;
- store safe error classes rather than raw remote responses;
- rotate and revoke keys without accepting ambiguous overlap.

## Payload policy

The default policy is deliberately conservative. Raising a limit changes the denial-of-service boundary and should be reviewed together with HTTP body limits, database column limits, queue payload limits, and handler complexity.

Prototype-related keys are rejected even though JSON itself permits them. This prevents later unsafe merge operations from turning valid connector input into prototype mutation.

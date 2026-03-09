# TeamChat AI – Test Credentials

Use the following credentials to verify multi-tenant behavior.

## Organizations

- `acme`
- `globex`

## Users

| Org Slug | Email              | Password      | Role  |
|---------:|--------------------|---------------|-------|
| `acme`   | `sarah@acme.com`   | `Summit@2026`  | admin |
| `acme`   | `mike@acme.com`    | `Summit@2026`  | member|
| `acme`   | `lisa@acme.com`    | `Summit@2026`  | member|
| `globex` | `alice@globex.com` | `Summit@2026`  | admin |
| `globex` | `bob@globex.com`   | `Summit@2026`  | member|
| `globex` | `eve@globex.com`   | `Summit@2026`  | member|

## How to Verify Tenant Isolation

1. **Open two browser windows** (or profiles).
2. In **Window A**:
   - Log in with org slug `acme` and `sarah@acme.com`.
3. In **Window B**:
   - Log in with org slug `globex` and `alice@globex.com`.
4. Confirm:
   - Room lists are different but consistent within each org.
   - Messages sent in `acme` rooms **do not** appear in `globex` and vice versa.
   - Invoking `@Gemini` / `@AI` in one org only streams AI messages to users in that org’s room.


<!-- Copilot instructions for coding agents interacting with this repo -->
# Pinseekr — Copilot Instructions

Purpose: give an AI coding agent immediate, actionable context about the project's architecture, developer workflows, and project-specific conventions.

1) Big picture
- React + Vite single-page client (src/) integrating with the Nostr protocol for decentralized data.
- Primary responsibilities:
  - UI & app logic: `src/` (components, hooks, contexts)
  - Nostr integration: `src/components/NostrProvider.tsx`, `src/hooks/*` (notably `useNostr`, `useNostrPublish`, `useAuthor`, `useCurrentUser`)
  - Relay discovery config: `public/pyramid-relays.json` and `server/pyramid_relays.*`
  - Deployment: `deploy/` (includes Grain/Umbrel instructions)

2) Key design decisions & why
- Nostr-first: most domain data lives as Nostr events (kinds in 0,3,4,1111 and custom 30000+).
- Tag-first/querying: use tags for all relay-queryable fields; the `t` tag is used for category filtering.
- Prefer existing NIPs where possible; create custom kinds only when necessary and document them in `NIP.md`.

3) Important files to inspect for context/examples
- [README.md](README.md) — repo summary and stack
- [CONTEXT.md](CONTEXT.md) — canonical system prompt / project guidance for assistants
- [NOSTR_IMPLEMENTATION.md](NOSTR_IMPLEMENTATION.md) and [NIP.md](NIP.md) — kinds, tags, and Nostr rules used by the app
- `src/components/NostrProvider.tsx` and `src/hooks/useNostr.ts` — relay pool & query/publish patterns
- `src/hooks/*` — canonical hook patterns using `useNostr` + `@tanstack/query`

4) Developer workflows (exact commands)
- Start dev server: `npm run dev` (installs then runs `vite`)
- Build: `npm run build` (installs then `vite build` and copies `index.html` to `404.html`)
- Test / CI: `npm run test` (typecheck via `tsc`, `eslint`, `vitest`, and `vite build`)
- Deploy (project-specific): `npm run deploy` (builds then runs `nostr-deploy-cli`)

5) Nostr and data conventions (must-follow)
- Queryable data → tags. Use `t` tags for categories so relays can filter (`'#t': ['golf-course']`).
- Content field: reserved for free text; structured, queryable fields must be tags.
- Custom kinds: use addressable kinds in 30000–39999 for per-d-id latest semantics (e.g., `30010` player-score, `30100` golf-course).
- When adding a new kind: update `NIP.md` and follow the project's tag design principles.

6) Relay behaviour & limits
- App discovers relays via `/pyramid-relays.json`; primary relay: `wss://relay.pinseekr.golf` (Grain), fallback listed in docs.
- Queries are combined where possible to avoid rate limits — prefer multi-kind single queries (see `CONTEXT.md` examples).

7) Patterns & idioms to follow when editing code
- Hook-first: encapsulate Nostr queries in `src/hooks/*` with `useQuery` wrappers.
- Keep UI components presentational; business logic stays in hooks or `lib/`.
- Use `cn()` utility for class merging and shadcn/ui component patterns (forwardRef, variant-driven styles).

8) Testing & validation notes
- The test script runs typechecks and `vitest`. New code should be type-safe and lint-clean to avoid CI failures.
- When adding new Nostr kinds, include validator logic in the corresponding hook (see validators in `CONTEXT.md`).

9) Security / integration points
- External signers: browser `window.nostr` (Alby, nos2x) and Nostr Wallet Connect (NIP-46). Check `useNWC` and `useWallet`.
- Payment/zap integrations: `ZapButton`, `ZapDialog`, `WalletModal`, and `@getalby/*` libs.

10) If you need to modify assistant behavior
- Modify `CONTEXT.md` to change the system prompt; changes take effect on next session.

Examples (quick references inside the repo):
- Player score event: defined in `NIP.md` (kind `30010`) — used by `usePlayerScores.ts`
- Comments: NIP-22 / kind `1111` — see `useComments.ts` and `usePostComment.ts`

If any section is unclear or you want more detail (for example, exact hook implementations or more examples of kinds), tell me which area to expand and I'll iterate.

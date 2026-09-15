# ACCESS-X

ACCESS-X helps blind and low-vision users understand what changed around them, why it matters for their route, and what to do next.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Web preview: `/`
- Mobile preview: `/access-x-mobile/`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/access-x-web` — responsive command center, change review, route context, and accessibility profile.
- `artifacts/access-x-mobile` — Expo companion with camera capture, assistant commands, change review, and preferences.
- `artifacts/api-server/src/lib/accessx.ts` — environment memory, comparisons, demo scenario, and preference-aware recommendations.
- `lib/api-spec/openapi.yaml` — source of truth for shared API contracts.

## Architecture decisions

- The web and mobile surfaces share the generated OpenAPI client and the same environment/reasoning endpoints.
- Demo Mode is explicit in the UI and returns a guided chair/elevator scenario; it does not claim live Gemini analysis.
- Safety copy always frames confidence as an estimate and asks the user to verify before proceeding.
- The first MVP keeps state in the API process so the core workflow is usable without external service setup; persistence can be added without changing the client contract.

## Product

- Live environment read with path status, obstacles, stairs, elevator, signs, confidence, and location.
- BEFORE → CHANGE → CURRENT STATE → IMPACT → RECOMMENDATION review.
- Preference-aware route guidance, including stair avoidance and elevator preference.
- Text/voice-style commands for describing the scene, checking changes, finding the elevator, and navigating to the Library.
- Guided Demo Mode for the complete memory and reasoning flow.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

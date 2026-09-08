# 🤖 Curatarr AGENTS.md

Mandatory architectural guidelines, quality standards, and execution rules for AI coding assistants working in **Curatarr**.

> **Archetype**: [Controls-Grade Fullstack (.NET + React + SQL)](https://github.com/spelech/AgenticEngineeringToolbelt/blob/main/archetypes/controls-fullstack-dotnet-react.md)  
> **Master Reference**: [AgenticEngineeringToolbelt](https://github.com/spelech/AgenticEngineeringToolbelt)

---

## 🤝 1. Collaboration & Workflow Discipline

1. **Proactive Clarifying Questions**: Steven's conceptual designs evolve during development. Part of the agent's primary job is to **ask insightful clarifying questions** to nail down requirements, edge cases, and design constraints before or during major changes.
2. **Git Branch & Commit Workflow**:
   - All new features and refactors start on a **fresh feature branch** off `develop` (or active task branch).
   - Use fine-grained, **atomic Conventional Commits** (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
   - Use `./commit.sh "<message>"` for building, testing, and creating atomic commits.
   - Do not merge to `main` until explicitly instructed by the user and all quality gates pass.
3. **Container Immutability**:
   - **NEVER** edit files or hot-patch code inside live running containers (`docker cp`, live container file edits).
   - Always build images cleanly (`docker build -t ghcr.io/spelech/curatarr:latest .`) followed by compose recreation (`cd /containers/media_utils && docker compose up -d --force-recreate curatarr`).
   - Containers are immutable runtime artifacts.

---

## 🏛️ 2. Architecture & Persistence

1. **Backend (.NET 10 / C#)**:
   - Modern `.slnx` solution format with `<Nullable>enable</Nullable>`, `<ImplicitUsings>enable</ImplicitUsings>`, and `Directory.Build.props`.
   - **Persistence**: Relational SQLite in WAL mode with **Dapper** queries and `IDbConnectionFactory`. Zero heavy ORMs (no Entity Framework Core).
   - Custom Dapper type handlers for UTC DateTimes (`DateTimeHandler`, `NullableDateTimeHandler`).
   - **100% CancellationToken propagation** across all async database, HTTP, and background sync operations.
2. **Embedded Model Context Protocol (MCP) Server**:
   - Embedded at `/mcp/sse` and `/mcp/messages` via [`CuratarrMcpRegistry.cs`](src/Curatarr.Api/Mcp/CuratarrMcpRegistry.cs).
   - AI agents can query library statistics, list pruning candidates, and execute safe deletions via standard MCP tool calls.
3. **Frontend (React 19 + TypeScript + Zustand + Vite)**:
   - TypeScript strict mode (`"strict": true`). Zero linter warnings permitted (`eslint . --max-warnings 0`).
   - **Zustand stores** organized per domain slice: [`useCatalogStore.ts`](src/Curatarr.Web/src/stores/useCatalogStore.ts), [`useConnectionStore.ts`](src/Curatarr.Web/src/stores/useConnectionStore.ts).
   - Mandatory granular selectors to prevent re-render cascades.
   - Pure Tailwind CSS with dark slate theme tokens; responsive dense grid layout (6–7 columns).

---

## 🧪 3. Testing & Verification Protocol

1. **Backend Tests**: xUnit + NSubstitute in [`tests/Curatarr.Tests`](tests/Curatarr.Tests).
   - Collect coverage via `dotnet test --collect:"XPlat Code Coverage"`. Target $\ge$ 80% coverage.
2. **Frontend Tests**: Vitest + `@testing-library/react` in [`src/Curatarr.Web`](src/Curatarr.Web).
   - Run `npm test` before any deployment.
3. **Playwright Layout Inspector (4-Point Audit)**:
   - Tested in [`tests/Curatarr.E2E/layout.spec.ts`](tests/Curatarr.E2E/layout.spec.ts):
     1. `expect(page).toHaveNoLayoutOverflow()` (Zero horizontal bleed)
     2. `expect(page).toHaveMobileFit()` (Responsive viewport scaling)
     3. `expect(page).toHaveTouchFriendlyTargets({ minSize: 24 })` (Touch ergonomics)
     4. `expect(page).toPassLayoutAudit({ minScore: 85 })` (Composite UX score)
4. **Empirical Verification**:
   - Never claim a task complete without running tests, rebuilding images, verifying container logs, and testing endpoints via `curl`.

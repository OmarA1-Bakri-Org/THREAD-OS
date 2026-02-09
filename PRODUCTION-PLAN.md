# ThreadOS Production Plan — Implementation Roadmap

> **Version**: 2.0 | **Status**: Active | **Last Updated**: 2026-02-07
> **Companion Document**: `PRODUCTION-PRD.md`

---

## 1. Current State Summary

**M0-M2 Foundation: COMPLETE (~95%)**

The backend runtime is solid. What exists:
- Sequence engine (schema, parser, DAG) — working
- mprocs adapter (client, config, state) — working
- Runner (wrapper, artifacts, prompts) — working
- CLI `seqctl` (init, step, run, status) — working
- Error handling hierarchy — working
- Atomic file operations — working

What's missing for production:
- Test suite (critical gap — 1 trivial test exists)
- Thread template logic (P/C/F/B/L patterns)
- Missing CLI commands (dep, group, fusion, gate, stop, restart)
- Audit logging
- Policy/SAFE mode enforcement
- HTTP API
- Horizontal Sequence UI
- Chat Orchestrator
- Documentation

---

## 2. Milestone Roadmap

```
M0-M2 ████████████████████████████████████████████░░ DONE (foundation)
M3    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ Thread Templates + Missing CLI
M4    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ Testing + Policy + Audit
M5    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ HTTP API + Horizontal UI
M6    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ Chat Orchestrator + Polish
```

---

## 3. Milestone 3: Thread Templates + CLI Completion

**Goal**: Complete all six thread types and all missing CLI commands so the runtime is fully functional from the command line.

### 3.1 Tasks

#### 3.1.1 Schema Extensions
**File**: `lib/sequence/schema.ts`

Add fields to `StepSchema`:
```
group_id, fanout, fusion_candidates, fusion_synth,
watchdog_for, orchestrator, timeout_ms, fail_policy
```

Add `metadata` and `policy` objects to `SequenceSchema`.

**Acceptance**: Existing tests still pass. New fields are optional with sensible defaults. Parser roundtrip preserves new fields.

#### 3.1.2 Dependency Commands
**Files**: `lib/seqctl/commands/dep.ts`, update `lib/seqctl/index.ts`

| Command | Behavior |
|---------|----------|
| `seqctl dep add <stepId> <depId>` | Add `depId` to step's `depends_on[]`. Validate no cycle created. |
| `seqctl dep rm <stepId> <depId>` | Remove `depId` from step's `depends_on[]`. |

**Acceptance**: Adding circular dep returns error. Removing non-existent dep returns error. DAG validated after every mutation.

#### 3.1.3 Group Commands (P-Thread)
**Files**: `lib/seqctl/commands/group.ts`, update `lib/seqctl/index.ts`

| Command | Behavior |
|---------|----------|
| `seqctl group parallelize <stepId1> <stepId2> [...]` | Assign shared `group_id`, set type to `p` |
| `seqctl group list` | Show all groups |
| `seqctl run group <groupId>` | Run all READY steps in group |

**Acceptance**: Group steps share `group_id`. Running group starts all READY members. `fail_policy` respected.

#### 3.1.4 Fusion Commands (F-Thread)
**Files**: `lib/seqctl/commands/fusion.ts`, update `lib/seqctl/index.ts`

| Command | Behavior |
|---------|----------|
| `seqctl fusion create --candidates <ids...> --synth <synthId>` | Create candidate steps + synth step. Synth `depends_on` all candidates. Mark candidates `fusion_candidates`, synth `fusion_synth: true`. |

**Acceptance**: Synth step auto-depends on all candidates. Running fusion runs candidates first, then synth. Synth receives candidate artifact paths.

#### 3.1.5 Gate Commands (C-Thread)
**Files**: `lib/seqctl/commands/gate.ts`, update `lib/seqctl/index.ts`

| Command | Behavior |
|---------|----------|
| `seqctl gate insert <gateId> --name <name> --depends-on <stepIds...>` | Create gate node in sequence |
| `seqctl gate approve <gateId>` | Set gate status to APPROVED. Unblock dependents. |
| `seqctl gate block <gateId>` | Set gate status to BLOCKED. |
| `seqctl gate list` | List all gates with status |

**Acceptance**: Steps depending on PENDING gate are BLOCKED. Approving gate transitions dependents to READY. Blocking gate keeps dependents BLOCKED.

#### 3.1.6 Stop/Restart Commands
**Files**: `lib/seqctl/commands/control.ts`, update `lib/seqctl/index.ts`

| Command | Behavior |
|---------|----------|
| `seqctl stop <stepId>` | Stop running step via mprocs. Set status to FAILED. |
| `seqctl restart <stepId>` | Restart step. Reset status to RUNNING. |

**Acceptance**: Stop sends SIGTERM via mprocs `term-proc`. Restart calls mprocs `restart-proc`. Status updates persisted.

#### 3.1.7 mprocs Session Commands
**Files**: `lib/seqctl/commands/mprocs.ts`, update `lib/seqctl/index.ts`

| Command | Behavior |
|---------|----------|
| `seqctl mprocs open` | Generate mprocs.yaml from sequence, launch mprocs with `--server` |
| `seqctl mprocs select <stepId>` | Focus step's process in mprocs UI |

**Acceptance**: `mprocs open` generates valid config and starts mprocs. `mprocs select` maps stepId to process index via mprocs-map.json.

#### 3.1.8 Thread Template Files
**Directory**: `lib/templates/`

Create template generators for each thread type:

| File | Purpose |
|------|---------|
| `lib/templates/base.ts` | Generate single-step base thread |
| `lib/templates/parallel.ts` | Generate N-worker P-thread with optional merge step |
| `lib/templates/chained.ts` | Generate phased C-thread with gates between phases |
| `lib/templates/fusion.ts` | Generate candidate + synth F-thread |
| `lib/templates/orchestrated.ts` | Generate B-thread orchestrator scaffold |
| `lib/templates/long-autonomy.ts` | Generate L-thread with optional watchdog |
| `lib/templates/index.ts` | Template registry + `seqctl template apply <type>` |

**Acceptance**: Each template generates valid sequence fragments that pass schema validation and DAG validation.

### 3.2 Dependency Graph (M3)

```
schema-extensions ─────┬──▶ dep-commands ──────────────┐
                       ├──▶ group-commands ─────────────┤
                       ├──▶ fusion-commands ────────────┤
                       ├──▶ gate-commands ──────────────┤──▶ M3 COMPLETE
                       ├──▶ stop-restart-commands ──────┤
                       ├──▶ mprocs-session-commands ────┤
                       └──▶ thread-templates ───────────┘
```

All tasks depend on schema extensions. Tasks are otherwise independent and parallelizable.

---

## 4. Milestone 4: Testing + Policy + Audit

**Goal**: Build safety infrastructure and comprehensive test coverage to make the system production-trustworthy.

### 4.1 Tasks

#### 4.1.1 Audit Logger
**Files**: `lib/audit/logger.ts`

```typescript
// Core interface
interface AuditLogger {
  log(entry: Omit<AuditEntry, 'timestamp'>): Promise<void>;
  read(options?: { limit?: number; offset?: number }): Promise<AuditEntry[]>;
  tail(n: number): Promise<AuditEntry[]>;
}
```

- Append-only JSONL writes to `.threados/audit.log`
- Use `fs.appendFile` (no atomic write needed for append)
- Secrets redaction: scrub patterns matching `(password|secret|token|key)=\S+`
- Reader supports pagination for API consumption

**Integration points**: Wrap every `writeSequence()` call and every `runStep()` call.

**Acceptance**: Every mutation produces audit entry. Entries parseable as JSONL. Secrets scrubbed.

#### 4.1.2 Policy Engine
**Files**: `lib/policy/engine.ts`, `lib/policy/schema.ts`

```typescript
interface PolicyEngine {
  validate(action: PolicyAction): PolicyResult;
  getMode(): 'SAFE' | 'POWER';
  setMode(mode: 'SAFE' | 'POWER'): void;
}

interface PolicyResult {
  allowed: boolean;
  reason?: string;           // Why denied
  confirmation_required: boolean;  // Needs user confirmation
}
```

Policy checks:
1. Command allowlist: runner command must start with allowed prefix
2. CWD restriction: step cwd must match allowed glob patterns
3. Fanout limit: P-thread fanout ≤ `max_fanout`
4. Concurrent limit: running steps ≤ `max_concurrent`
5. Forbidden patterns: command must not match any forbidden regex
6. SAFE mode: all run/apply actions require `confirmation_required: true`

**Acceptance**: Blocked commands return `allowed: false` with reason. Policy read from `.threados/policy.yaml`. Missing policy file uses safe defaults.

#### 4.1.3 Unit Test Suite
**Directory**: `lib/**/*.test.ts` (co-located with source)

Priority order for test implementation:

| Priority | Module | Key Test Cases | Min Coverage |
|----------|--------|---------------|--------------|
| 1 | `sequence/dag.test.ts` | No cycle, single cycle, diamond, multi-cycle, isolated nodes, empty graph | 95% |
| 2 | `sequence/schema.test.ts` | Valid step, invalid ID chars, missing required fields, enum validation, defaults | 95% |
| 3 | `sequence/parser.test.ts` | Roundtrip, malformed YAML, missing file, empty sequence, large sequence | 90% |
| 4 | `runner/wrapper.test.ts` | Success exit, nonzero exit, timeout, signal, missing command | 90% |
| 5 | `runner/artifacts.test.ts` | Dir creation, file writes, status JSON shape, concurrent writes | 90% |
| 6 | `mprocs/client.test.ts` | Command YAML serialization, error handling, batch (mock shell) | 85% |
| 7 | `mprocs/config.test.ts` | Config shape per thread type, custom options, server address | 85% |
| 8 | `mprocs/state.test.ts` | Read/write/update map, missing file, concurrent updates | 85% |
| 9 | `policy/engine.test.ts` | Allow, deny (each check type), SAFE vs POWER, missing policy | 95% |
| 10 | `audit/logger.test.ts` | Write entry, read entries, pagination, secrets redaction | 90% |
| 11 | `seqctl/commands/*.test.ts` | Each command with valid/invalid inputs, JSON output mode | 85% |
| 12 | `prompts/manager.test.ts` | CRUD, missing files, list | 85% |
| 13 | `errors.test.ts` | Error codes, messages, instanceof checks | 95% |
| 14 | `fs/atomic.test.ts` | Write success, write failure cleanup, concurrent writes | 90% |

Test infrastructure setup:
- Use Bun's built-in test runner (`bun:test`)
- Add `"test": "bun test"` to `package.json` scripts
- Create `test/fixtures/` for shared test data (sample sequences, policies)
- Create `test/helpers/` for test utilities (temp dir creation, sequence builders)

#### 4.1.4 Integration Tests
**Directory**: `test/integration/`

| Test | Flow |
|------|------|
| `cli-lifecycle.test.ts` | `init → step add → dep add → run runnable → status` |
| `thread-base.test.ts` | Create base thread → run → verify artifacts |
| `thread-parallel.test.ts` | Create P-thread group → run group → verify all complete |
| `thread-chained.test.ts` | Create C-thread → run phase 1 → approve gate → run phase 2 |
| `thread-fusion.test.ts` | Create F-thread → run candidates → run synth |
| `policy-enforcement.test.ts` | Set policy → attempt blocked action → verify denial + audit |
| `state-reconciliation.test.ts` | Simulate crash → restart → verify orphan detection |

#### 4.1.5 CI Configuration
**File**: `.github/workflows/ci.yml`

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun test
      - run: bun run lint
      - run: bun run build
```

### 4.2 Dependency Graph (M4)

```
audit-logger ──────────────────────────────────┐
policy-engine ─────────────────────────────────┤
unit-tests (independent, parallelizable) ──────┤──▶ integration-tests ──▶ CI ──▶ M4 COMPLETE
```

Audit logger and policy engine can be built in parallel. Unit tests can start immediately (no dependency on new features). Integration tests depend on everything else.

---

## 5. Milestone 5: HTTP API + Horizontal Sequence UI

**Goal**: Build the visual interface for managing sequences with real-time updates.

### 5.1 Tasks

#### 5.1.1 HTTP API Layer
**Directory**: `app/api/`

Implementation approach: Next.js Route Handlers that wrap `seqctl` logic.

| File | Endpoints |
|------|-----------|
| `app/api/sequence/route.ts` | `GET /api/sequence` — returns current sequence |
| `app/api/status/route.ts` | `GET /api/status` — returns status snapshot |
| `app/api/status/stream/route.ts` | `GET /api/status/stream` — SSE of status changes (poll every 500ms) |
| `app/api/run/route.ts` | `POST /api/run` — run step or runnable frontier |
| `app/api/stop/route.ts` | `POST /api/stop` — stop step |
| `app/api/restart/route.ts` | `POST /api/restart` — restart step |
| `app/api/step/route.ts` | `POST /api/step` — add/edit/rm/clone step |
| `app/api/dep/route.ts` | `POST /api/dep` — add/rm dependency |
| `app/api/gate/route.ts` | `POST /api/gate` — insert/approve/block gate |
| `app/api/group/route.ts` | `POST /api/group` — parallelize steps |
| `app/api/fusion/route.ts` | `POST /api/fusion` — create fusion structure |
| `app/api/audit/route.ts` | `GET /api/audit` — read audit log entries |
| `app/api/runs/[runId]/[stepId]/route.ts` | `GET` — read run artifacts |

All mutating routes:
1. Parse + validate request body with Zod
2. Check policy engine
3. Execute action
4. Write audit log entry
5. Return JSON result

**Acceptance**: All endpoints return proper JSON. Errors return `{ error, code }`. Policy denials return 403. Audit entries written for every mutation.

#### 5.1.2 API Client Hook
**File**: `lib/ui/api.ts`

```typescript
// React Query hooks for API consumption
export function useSequence(): UseQueryResult<Sequence>
export function useStatus(): UseQueryResult<SequenceStatus>
export function useStatusStream(): EventSourceHook  // SSE
export function useRunStep(): UseMutationResult
export function useStopStep(): UseMutationResult
// ... etc
```

#### 5.1.3 Install UI Dependencies
Add to `package.json`:
```
@xyflow/react (React Flow v12)
dagre (graph layout)
react-resizable-panels
@tanstack/react-query
zustand
```

#### 5.1.4 App Layout
**File**: `app/layout.tsx` (rewrite), `app/page.tsx` (rewrite)

Replace Next.js boilerplate with ThreadOS layout:
- Root layout with `QueryClientProvider` and `ThemeProvider`
- Main page with three-panel resizable layout:
  - Left: Sequence Canvas (React Flow)
  - Right: Step Inspector (detail panel)
  - Bottom: Chat Orchestrator (collapsible)
- Top toolbar: Run Runnable, SAFE/POWER toggle, search

#### 5.1.5 React Flow Canvas
**Directory**: `components/canvas/`

| File | Purpose |
|------|---------|
| `components/canvas/SequenceCanvas.tsx` | Main React Flow wrapper with dagre layout |
| `components/canvas/StepNode.tsx` | Custom node for steps (type badge, status chip, model, quick actions) |
| `components/canvas/GateNode.tsx` | Diamond-shaped gate node with approve/block actions |
| `components/canvas/GroupBoundary.tsx` | Dashed rectangle around P-thread group members |
| `components/canvas/FusionMerge.tsx` | Triangle merge point for F-thread synth |
| `components/canvas/DependencyEdge.tsx` | Animated edge with status-aware coloring |
| `components/canvas/useSequenceGraph.ts` | Hook: converts Sequence → React Flow nodes/edges |
| `components/canvas/useAutoLayout.ts` | Hook: dagre layout computation (left-to-right) |

**Node behavior**:
- Click: Select node → show in inspector
- Right-click: Context menu (run, stop, restart, edit, delete)
- Drag: Reorder (validates dependency constraints)
- Double-click: Open prompt editor

#### 5.1.6 Step Inspector Panel
**Directory**: `components/inspector/`

| File | Purpose |
|------|---------|
| `components/inspector/StepInspector.tsx` | Main inspector panel (shows selected step details) |
| `components/inspector/StepForm.tsx` | Editable form for step properties |
| `components/inspector/StepLogs.tsx` | Real-time log viewer (stdout/stderr from latest run) |
| `components/inspector/StepActions.tsx` | Action buttons: Run, Stop, Restart, Edit Prompt, View Diff |
| `components/inspector/GateInspector.tsx` | Gate details with Approve/Block buttons |

#### 5.1.7 Toolbar
**File**: `components/toolbar/Toolbar.tsx`

Controls:
- **Run Runnable** button (primary CTA)
- **SAFE/POWER** mode toggle with confirmation dialog
- **Search** input (filters visible nodes)
- **Minimap** toggle
- **Zoom** controls
- **Sequence name** display

#### 5.1.8 UI State Management
**File**: `lib/ui/store.ts`

Zustand store for UI-only state:
```typescript
interface UIStore {
  selectedNodeId: string | null;
  inspectorOpen: boolean;
  chatOpen: boolean;
  policyMode: 'SAFE' | 'POWER';
  searchQuery: string;
  minimapVisible: boolean;
}
```

Server state (sequence, status) is managed by React Query with SSE invalidation.

### 5.2 Dependency Graph (M5)

```
install-deps ──▶ api-layer ──────────┐
                 api-client-hooks ────┤
                                      ├──▶ app-layout ──▶ canvas ──┐
                                      │                  inspector ─┤──▶ M5 COMPLETE
                                      │                  toolbar ───┤
                                      └──▶ ui-store ───────────────┘
```

API layer and client hooks first. Then layout. Then canvas, inspector, and toolbar in parallel.

---

## 6. Milestone 6: Chat Orchestrator + Production Polish

**Goal**: Add the natural-language orchestration interface and polish everything for release.

### 6.1 Tasks

#### 6.1.1 Chat UI Component
**Directory**: `components/chat/`

| File | Purpose |
|------|---------|
| `components/chat/ChatPanel.tsx` | Collapsible chat panel with message history |
| `components/chat/ChatInput.tsx` | Input with send button, supports Enter to send |
| `components/chat/MessageBubble.tsx` | Renders user and assistant messages |
| `components/chat/ActionCard.tsx` | Renders proposed actions with Apply/Apply&Run/Discard |
| `components/chat/DiffPreview.tsx` | Unified diff view of proposed sequence.yaml changes |
| `components/chat/ConfirmDialog.tsx` | Double-confirmation dialog for destructive actions |

#### 6.1.2 Chat API Endpoint
**File**: `app/api/chat/route.ts`

- Accepts `{ message: string }` POST body
- Returns SSE stream with:
  1. `type: 'message'` — natural language response chunks
  2. `type: 'actions'` — array of `ProposedAction` objects
  3. `type: 'diff'` — unified diff of proposed changes
  4. `type: 'done'` — stream complete

The endpoint:
1. Takes user message + current sequence as context
2. Calls LLM API (Claude) with system prompt defining available `seqctl` commands
3. LLM generates structured action array
4. Server validates actions via dry-run
5. Streams response + actions + diff to client

#### 6.1.3 Chat System Prompt
**File**: `lib/chat/system-prompt.ts`

Define the system prompt that teaches the LLM about:
- Available `seqctl` commands and their parameters
- Current sequence state (injected dynamically)
- Policy constraints
- Output format (JSON action array)
- Safety rules (never auto-execute, always propose)

#### 6.1.4 Action Validator
**File**: `lib/chat/validator.ts`

```typescript
interface ActionValidator {
  validate(actions: ProposedAction[]): Promise<ValidationResult>;
  dryRun(actions: ProposedAction[]): Promise<DryRunResult>;
  apply(actions: ProposedAction[]): Promise<ApplyResult>;
}
```

- `validate()`: Check actions are syntactically valid `seqctl` commands
- `dryRun()`: Execute actions against a copy of sequence to compute diff
- `apply()`: Execute actions for real, with policy checks and audit logging

#### 6.1.5 State Reconciliation
**File**: `lib/reconciliation/reconciler.ts`

On startup / reconnection:
1. Read mprocs-map.json for last-known state
2. Query mprocs server for live processes
3. Compare with sequence.yaml step statuses
4. Mark orphaned RUNNING steps as FAILED
5. Log reconciliation actions to audit log

#### 6.1.6 Documentation
**Files to create/update**:

| File | Content |
|------|---------|
| `README.md` | Rewrite: project overview, installation, quick start, architecture diagram |
| `docs/cli-reference.md` | Complete `seqctl` command reference with examples |
| `docs/ui-guide.md` | UI walkthrough with screenshots/descriptions |
| `docs/thread-types.md` | Guide to each thread type with use cases and examples |
| `docs/llm-integration.md` | How to use ThreadOS as an LLM orchestration target |
| `docs/policy.md` | Policy configuration reference |
| `docs/contributing.md` | Dev setup, testing, PR guidelines |

#### 6.1.7 Production Hardening

| Task | Details |
|------|---------|
| Error boundaries | React error boundaries around canvas, inspector, chat |
| Loading states | Skeleton loaders for all async components |
| Empty states | Helpful messages when no sequence/steps exist |
| Keyboard shortcuts | `Ctrl+Enter` run runnable, `Ctrl+K` search, `Esc` close panels |
| Responsive panels | Min/max widths, collapse to icons on small screens |
| Favicon + meta | ThreadOS branding, proper `<title>`, Open Graph tags |
| `seqctl` as bin | Add `"bin"` entry to `package.json` for global install |
| Cross-platform | Test on Linux/Mac; document mprocs setup per platform |

### 6.2 Dependency Graph (M6)

```
chat-system-prompt ──▶ chat-api ──▶ chat-ui ──────────┐
action-validator ──────────────────────────────────────┤
state-reconciliation ──────────────────────────────────┤──▶ production-hardening ──▶ docs ──▶ M6 COMPLETE
```

---

## 7. Task Harness (All Milestones)

Complete task breakdown in dependency order. Tasks within the same milestone that don't have cross-dependencies can be parallelized.

### M3: Thread Templates + CLI Completion

```yaml
tasks:
  - id: m3-schema-ext
    name: "Extend sequence schema with template fields"
    files: [lib/sequence/schema.ts]
    depends_on: []

  - id: m3-dep-commands
    name: "Implement seqctl dep add/rm"
    files: [lib/seqctl/commands/dep.ts, lib/seqctl/index.ts]
    depends_on: [m3-schema-ext]

  - id: m3-gate-commands
    name: "Implement seqctl gate insert/approve/block/list"
    files: [lib/seqctl/commands/gate.ts, lib/seqctl/index.ts]
    depends_on: [m3-schema-ext]

  - id: m3-group-commands
    name: "Implement seqctl group parallelize/list + run group"
    files: [lib/seqctl/commands/group.ts, lib/seqctl/index.ts, lib/seqctl/commands/run.ts]
    depends_on: [m3-schema-ext]

  - id: m3-fusion-commands
    name: "Implement seqctl fusion create"
    files: [lib/seqctl/commands/fusion.ts, lib/seqctl/index.ts]
    depends_on: [m3-schema-ext]

  - id: m3-control-commands
    name: "Implement seqctl stop/restart"
    files: [lib/seqctl/commands/control.ts, lib/seqctl/index.ts]
    depends_on: [m3-schema-ext]

  - id: m3-mprocs-commands
    name: "Implement seqctl mprocs open/select"
    files: [lib/seqctl/commands/mprocs.ts, lib/seqctl/index.ts]
    depends_on: [m3-schema-ext]

  - id: m3-templates
    name: "Create thread template generators"
    files: [lib/templates/*.ts]
    depends_on: [m3-schema-ext, m3-gate-commands, m3-group-commands, m3-fusion-commands]
```

### M4: Testing + Policy + Audit

```yaml
tasks:
  - id: m4-test-infra
    name: "Set up test infrastructure (fixtures, helpers, scripts)"
    files: [test/fixtures/, test/helpers/, package.json]
    depends_on: []

  - id: m4-audit-logger
    name: "Implement audit logger"
    files: [lib/audit/logger.ts, lib/audit/schema.ts]
    depends_on: []

  - id: m4-policy-engine
    name: "Implement policy engine"
    files: [lib/policy/engine.ts, lib/policy/schema.ts]
    depends_on: []

  - id: m4-unit-tests-core
    name: "Unit tests: sequence (schema, parser, dag)"
    files: [lib/sequence/*.test.ts]
    depends_on: [m4-test-infra]

  - id: m4-unit-tests-runner
    name: "Unit tests: runner (wrapper, artifacts)"
    files: [lib/runner/*.test.ts]
    depends_on: [m4-test-infra]

  - id: m4-unit-tests-mprocs
    name: "Unit tests: mprocs (client, config, state)"
    files: [lib/mprocs/*.test.ts]
    depends_on: [m4-test-infra]

  - id: m4-unit-tests-cli
    name: "Unit tests: seqctl commands"
    files: [lib/seqctl/commands/*.test.ts]
    depends_on: [m4-test-infra]

  - id: m4-unit-tests-policy-audit
    name: "Unit tests: policy engine + audit logger"
    files: [lib/policy/*.test.ts, lib/audit/*.test.ts]
    depends_on: [m4-test-infra, m4-audit-logger, m4-policy-engine]

  - id: m4-integration-tests
    name: "Integration tests: CLI lifecycle, thread types, policy"
    files: [test/integration/*.test.ts]
    depends_on: [m4-unit-tests-core, m4-unit-tests-runner, m4-unit-tests-cli, m4-audit-logger, m4-policy-engine]

  - id: m4-ci
    name: "Set up CI pipeline"
    files: [.github/workflows/ci.yml]
    depends_on: [m4-integration-tests]
```

### M5: HTTP API + Horizontal UI

```yaml
tasks:
  - id: m5-install-deps
    name: "Install UI dependencies (react-flow, dagre, zustand, react-query)"
    files: [package.json]
    depends_on: []

  - id: m5-api-layer
    name: "Implement all HTTP API route handlers"
    files: [app/api/**/*.ts]
    depends_on: [m4-audit-logger, m4-policy-engine]

  - id: m5-api-client
    name: "Create React Query hooks for API"
    files: [lib/ui/api.ts]
    depends_on: [m5-api-layer]

  - id: m5-ui-store
    name: "Create Zustand UI state store"
    files: [lib/ui/store.ts]
    depends_on: [m5-install-deps]

  - id: m5-app-layout
    name: "Rewrite app layout with resizable panels"
    files: [app/layout.tsx, app/page.tsx]
    depends_on: [m5-api-client, m5-ui-store]

  - id: m5-canvas
    name: "Build React Flow sequence canvas with custom nodes"
    files: [components/canvas/*.tsx]
    depends_on: [m5-app-layout]

  - id: m5-inspector
    name: "Build step inspector panel"
    files: [components/inspector/*.tsx]
    depends_on: [m5-app-layout]

  - id: m5-toolbar
    name: "Build top toolbar"
    files: [components/toolbar/*.tsx]
    depends_on: [m5-app-layout]
```

### M6: Chat Orchestrator + Polish

```yaml
tasks:
  - id: m6-chat-system-prompt
    name: "Create chat orchestrator system prompt"
    files: [lib/chat/system-prompt.ts]
    depends_on: []

  - id: m6-action-validator
    name: "Build action validator and dry-run engine"
    files: [lib/chat/validator.ts]
    depends_on: []

  - id: m6-chat-api
    name: "Implement chat API endpoint with SSE streaming"
    files: [app/api/chat/route.ts]
    depends_on: [m6-chat-system-prompt, m6-action-validator, m5-api-layer]

  - id: m6-chat-ui
    name: "Build chat panel components"
    files: [components/chat/*.tsx]
    depends_on: [m6-chat-api, m5-app-layout]

  - id: m6-reconciliation
    name: "Implement state reconciliation on startup"
    files: [lib/reconciliation/reconciler.ts]
    depends_on: [m4-audit-logger]

  - id: m6-hardening
    name: "Production hardening (error boundaries, loading states, keyboard shortcuts)"
    files: [components/*, app/*]
    depends_on: [m5-canvas, m5-inspector, m6-chat-ui]

  - id: m6-docs
    name: "Write documentation (README, CLI ref, UI guide, thread types, LLM integration)"
    files: [README.md, docs/*.md]
    depends_on: [m6-hardening]

  - id: m6-seqctl-bin
    name: "Package seqctl as installable binary"
    files: [package.json, bin/seqctl]
    depends_on: [m6-hardening]
```

---

## 8. Critical Path

The longest dependency chain determines the minimum time to production:

```
M3: schema-ext → dep/gate/group/fusion commands → templates
                                                       │
M4: test-infra → unit tests → integration tests → CI  │
    audit-logger ──────────────────────────────────────┤
    policy-engine ─────────────────────────────────────┤
                                                       │
M5: install-deps → api-layer → api-client → layout → canvas/inspector/toolbar
                                                       │
M6: chat-system-prompt + validator → chat-api → chat-ui → hardening → docs
```

**Critical path**: `schema-ext → templates → audit+policy → api-layer → layout → canvas → chat-ui → hardening → docs`

### Parallelization Opportunities

These can be done concurrently:
- **M3**: All command implementations (dep, gate, group, fusion, control, mprocs) after schema-ext
- **M4**: Audit logger + policy engine + test infrastructure (all independent)
- **M4**: All unit test modules (independent of each other)
- **M5**: Canvas + inspector + toolbar (after layout)
- **M6**: Chat system prompt + action validator (independent)
- **M6**: Documentation (mostly independent of code, can start early)

---

## 9. Quality Gates

Each milestone must pass these gates before the next begins:

### M3 Gate
- [ ] All `seqctl` commands listed in help text are implemented and return valid JSON
- [ ] Each thread type (P/C/F/B/L) can be created via CLI
- [ ] `seqctl --help` accurately reflects all available commands
- [ ] Schema extensions don't break existing M0-M2 functionality

### M4 Gate
- [ ] `bun test` passes with 0 failures
- [ ] Line coverage >80% on `lib/`
- [ ] Integration tests pass for all thread types
- [ ] Policy engine blocks forbidden commands
- [ ] Audit log captures all mutations
- [ ] CI pipeline runs green on push/PR

### M5 Gate
- [ ] All API endpoints respond correctly (test with curl/httpie)
- [ ] UI renders sequence with correct node types and status colors
- [ ] Real-time status updates visible in UI (SSE working)
- [ ] Run/stop/restart/approve actions work from UI
- [ ] Panel resizing, search, and minimap functional
- [ ] No console errors in browser

### M6 Gate (Production Release)
- [ ] Chat correctly generates actions for common requests
- [ ] SAFE mode approval flow works end-to-end
- [ ] State reconciliation handles orphaned processes
- [ ] All documentation complete and accurate
- [ ] `seqctl` installable via `bun install -g`
- [ ] No known P0/P1 bugs
- [ ] Performance: UI responsive with 100+ nodes

---

## 10. Technical Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Graph rendering | React Flow v12 | Most mature React DAG library; custom nodes; built-in pan/zoom/minimap |
| Graph layout | Dagre | Standard hierarchical layout; left-to-right support; small bundle |
| Server state | React Query | Automatic cache invalidation; SSE integration; optimistic updates |
| UI state | Zustand | Minimal boilerplate; no providers needed; TypeScript-first |
| Chat streaming | SSE (Server-Sent Events) | Simpler than WebSocket for unidirectional server→client; native browser API |
| Test runner | Bun test | Already using Bun runtime; fast; built-in mocking and assertions |
| Audit format | JSONL | Append-friendly; line-parseable; grep-compatible; no corruption risk |
| Policy format | YAML | Consistent with sequence.yaml; human-readable; already have YAML lib |
| API style | Next.js Route Handlers | Co-located with UI; automatic TypeScript; no separate server needed |

---

## 11. Open Questions

| Question | Options | Recommendation |
|----------|---------|----------------|
| Which LLM API for chat orchestrator? | Claude API, local model, configurable | Start with Claude API; make provider configurable |
| Should sequence.yaml support includes/refs? | Single file vs multi-file | Single file for v1; consider `$ref` in v2 |
| Git worktree integration for step CWD? | Auto-create worktrees vs manual | Manual for v1; auto-create as opt-in in v2 |
| Should audit log rotate? | Unbounded vs size-limited | Unbounded for v1; add rotation config in v2 |
| Cross-platform mprocs? | Windows-only vs multi-platform | Ship Windows binary; document Linux/Mac build from source |
| Should UI support offline/disconnected? | Online-only vs offline-capable | Online-only (needs mprocs server); file state survives crashes |

# ThreadOS Frontend Review

**Reviewer:** Frontend Design & Engineering Specialist
**Date:** 2026-02-08
**Overall Grade: B-**

## Summary

This is a solid first-pass implementation of a DAG orchestration UI. The architecture choices are sound — React Flow for the canvas, Zustand for UI state, React Query for server state, and resizable panels for layout. The code is clean, readable, and reasonably well-typed. However, it's clearly in "get it working" mode: accessibility is almost entirely absent, dark mode is defined in CSS but unused in components, loading/error/empty states are built but not wired up, and several React Flow best practices are missed.

**What's done well:**
- Clean separation of concerns (canvas, inspector, chat, toolbar)
- `nodeTypes` and `edgeTypes` defined outside the component (avoids re-renders) ✓
- Custom nodes properly `memo`'d ✓
- Zustand store is lean with good selectors (no selector bloat)
- React Query configured with sensible `staleTime` and `refetchInterval`
- Error boundaries wrapping each major panel
- API routes use Zod validation and consistent error handling via `handleError`
- SSE streaming for both chat and status updates

---

## Critical Issues (Must Fix Before Shipping)

### 1. Zero Keyboard Accessibility on Canvas Nodes
**Files:** `StepNode.tsx`, `GateNode.tsx`

Nodes use `<div onClick>` with no `role`, `tabIndex`, or `onKeyDown`. A keyboard user literally cannot interact with the DAG.

```tsx
// StepNode.tsx — current
<div onClick={() => setSelected(id)} className="...">

// Fix
<div
  role="button"
  tabIndex={0}
  onClick={() => setSelected(id)}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(id) } }}
  aria-label={`Step ${d.name}, status ${d.status}`}
  className="... focus:outline-none focus:ring-2 focus:ring-ring"
>
```

Same fix needed for `GateNode.tsx`.

### 2. Hardcoded `bg-white` Breaks Dark Mode
**Files:** `StepNode.tsx`, `GateNode.tsx`, `Toolbar.tsx`

CSS custom properties for dark mode are fully defined in `globals.css`, but components use hardcoded colors:

- `StepNode.tsx`: `bg-white`, `text-gray-500`, `bg-gray-100`
- `GateNode.tsx`: `background: 'white'` (inline style)
- `Toolbar.tsx`: `bg-white`, `text-gray-500`, `text-gray-600`

**Fix:** Replace with design tokens: `bg-card`, `text-muted-foreground`, `bg-muted`. For GateNode's inline style, use `background: 'var(--card)'` or move to a Tailwind class.

### 3. No Dark Mode Toggle Exists
The CSS has a full `.dark` theme but there's no mechanism to apply the `dark` class to `<html>`. Need either `next-themes` or a manual toggle. Without this, 50% of your CSS is dead code.

### 4. StepActions Buttons Have No Loading/Disabled State
**File:** `StepActions.tsx`

Clicking "Run" fires a mutation but the button stays enabled. User can spam-click. No feedback that the action is in progress.

```tsx
// Current
<button onClick={() => runStep.mutate(nodeId)} className="...">Run</button>

// Fix
<button
  onClick={() => runStep.mutate(nodeId)}
  disabled={runStep.isPending}
  className="... disabled:opacity-50"
>
  {runStep.isPending ? 'Running...' : 'Run'}
</button>
```

### 5. Chat SSE Parsing is Fragile
**File:** `ChatPanel.tsx`

The SSE parser splits on `\n` and assumes each line is complete. SSE chunks can split mid-line. The `TextDecoder` doesn't handle this — you need a line buffer.

```tsx
// Problem: chunk could be "data: {\"type\":\"mes" then next chunk "sage\"}\n\n"
const lines = chunk.split('\n')

// Fix: accumulate a buffer
let buffer = ''
// in the loop:
buffer += decoder.decode(value, { stream: true })
const parts = buffer.split('\n\n')
buffer = parts.pop() || ''
for (const part of parts) {
  const line = part.trim()
  if (!line.startsWith('data: ')) continue
  // parse...
}
```

### 6. `handleApply` in ChatPanel is a No-Op
**File:** `ChatPanel.tsx`, line ~80

```tsx
const handleApply = useCallback(async (actions: ProposedAction[]) => {
  // TODO: call validator.apply() via API
  console.log('Apply actions:', actions)
}, [])
```

The "Apply" button on ActionCard does nothing. Either implement it or hide the button. Shipping a button that does nothing is worse than not having it.

---

## Important Improvements (Should Fix)

### 7. `LoadingSpinner` and `EmptyState` Are Built But Never Used
**Files:** `LoadingSpinner.tsx`, `EmptyState.tsx`, `SequenceCanvas.tsx`

`SequenceCanvas` renders with `useStatus()` but never checks `isLoading`, `isError`, or empty data. Same for `StepInspector`.

```tsx
// SequenceCanvas.tsx — should be:
export function SequenceCanvas() {
  const { data: status, isLoading, isError, error } = useStatus()
  // ...
  if (isLoading) return <LoadingSpinner message="Loading sequence..." />
  if (isError) return <EmptyState /> // or an error state
  if (!status || (status.steps.length === 0 && status.gates.length === 0)) return <EmptyState />
  // ... render ReactFlow
}
```

### 8. No `onError` Callbacks on Mutations
**File:** `api.ts`

All mutations only have `onSuccess`. Failed mutations silently disappear. Add `onError` to show user feedback (toast, inline error, etc.).

```tsx
return useMutation({
  mutationFn: (stepId: string) => postJson('/api/run', { stepId }),
  onSuccess: () => { /* invalidate */ },
  onError: (err) => { /* toast or store error */ },
})
```

### 9. Inspector Doesn't Open Automatically When Node Selected
**Files:** `store.ts`, `StepNode.tsx`

Clicking a node sets `selectedNodeId` but doesn't open the inspector if it's closed. The user clicks a node, nothing visible happens.

```tsx
// store.ts
setSelectedNodeId: (id) => set({ selectedNodeId: id, inspectorOpen: id !== null }),
```

### 10. Chat Panel Has No Toggle Button
**File:** `Toolbar.tsx`, `store.ts`

`chatOpen` exists in the store and `toggleChat` is defined, but there's no button in the toolbar to open/close chat. The chat panel is invisible by default (`chatOpen: false`) with no way to show it.

Add to Toolbar:
```tsx
<button onClick={toggleChat} className="text-xs text-gray-600 hover:text-gray-900">Chat</button>
```

### 11. `useSequenceGraph` Spreads Entire Step/Gate into Node Data
**File:** `useSequenceGraph.ts`

```tsx
data: { ...step, color: STATUS_COLORS[step.status] || '#94a3b8' }
```

This puts every field from the API response into React Flow's node data. If the API response grows, this causes unnecessary re-renders. Pick only needed fields.

### 12. No Confirmation on Destructive Actions
**File:** `StepActions.tsx`

"Stop" and "Block" are destructive actions with no confirmation. At minimum, add a `window.confirm()` or better, a confirmation popover.

### 13. Toolbar Search Has No Debounce
**File:** `Toolbar.tsx`

Every keystroke triggers `setSearchQuery` → re-renders the entire DAG (dagre layout recalculation). Add a 300ms debounce.

### 14. Status Polling + SSE Endpoint Redundancy
**Files:** `api.ts`, `app/api/status/stream/route.ts`

`useStatus()` polls every 2s, but there's also an SSE endpoint at `/api/status/stream`. Pick one. SSE is better for real-time; polling is simpler. Using both wastes resources. If you keep polling, delete the SSE route. If you use SSE, replace the polling query.

---

## Nice-to-Haves (Polish)

### 15. Responsive Design
The layout assumes desktop. On mobile, three-panel layout is unusable. Consider:
- Hiding inspector/chat behind slide-out drawers on `<768px`
- Making the toolbar scrollable or collapsible

### 16. React Flow `fitView` on Data Change
Currently `fitView` only runs on mount. When nodes are added/removed or search filters change, the view doesn't adjust. Add `fitView` as a prop with a key or use `useReactFlow().fitView()` in an effect.

### 17. Semantic HTML in Inspector
**File:** `StepForm.tsx`

`<label>` elements aren't associated with any form control (there are no form controls — it's all read-only `<div>`s). Either use `<dl>/<dt>/<dd>` for definition lists or add actual editable fields.

```tsx
<dl className="space-y-3 mt-3">
  <div>
    <dt className="text-xs text-muted-foreground">Name</dt>
    <dd className="text-sm font-medium">{step.name}</dd>
  </div>
</dl>
```

### 18. `'use client'` on Pure Display Components
**Files:** `MessageBubble.tsx`, `DiffPreview.tsx`, `StepForm.tsx`

These components have no hooks or browser APIs. They don't need `'use client'`. Removing it allows Next.js to server-render them (minor optimization but correct practice).

### 19. Type the `data` Prop Properly in Nodes
**Files:** `StepNode.tsx`, `GateNode.tsx`

```tsx
// Current: cast inside component
const d = data as { id: string; name: string; ... }

// Better: define a type and use NodeProps<StepNodeData>
type StepNodeData = { id: string; name: string; status: string; type: string; model: string; color: string }
function StepNodeComponent({ id, data }: NodeProps<Node<StepNodeData>>) {
```

### 20. Status Color Mapping Duplicated
`STATUS_COLORS` lives in `useSequenceGraph.ts`. It'll be needed elsewhere (inspector, toolbar status dots). Extract to a shared `lib/ui/constants.ts`.

### 21. Chat Input Should Be a `<textarea>` 
**File:** `ChatInput.tsx`

Using `<input type="text">` but handling Shift+Enter suggests multi-line was intended. Use `<textarea>` with auto-resize for better UX.

### 22. Missing `aria-live` on Chat Messages
**File:** `ChatPanel.tsx`

New messages appear with no screen reader announcement. Add `aria-live="polite"` to the messages container.

---

## API Contract Assessment

**Grade: A-**

The API routes are well-structured:
- Consistent use of Zod for input validation
- Centralized error handling via `handleError`
- Audit logging on all mutations
- Consistent response shapes (`{ success, action, ... }` for mutations)
- DAG validation before every write

**Minor issues:**
- Some routes return `{ success: true }` while errors return `{ error: string }`. Consider wrapping all in `{ success, data?, error? }` for uniformity.
- The chat route returns SSE but error responses return JSON — client needs to handle both content types.
- No rate limiting on any route.

---

## Architecture Notes

The Zustand + React Query split is textbook correct: Zustand for ephemeral UI state (selection, panel toggles), React Query for server state (sequence data). No complaints on that front.

The one architectural concern is that `page.tsx` conditionally renders panels, which causes React Flow to unmount/remount when toggling inspector or chat. This loses React Flow's internal state (zoom level, pan position). Consider using CSS visibility or absolute positioning instead of conditional rendering for the panels.

```tsx
// Instead of conditional rendering:
{inspectorOpen && <Panel>...</Panel>}

// Use CSS to hide:
<Panel style={{ display: inspectorOpen ? 'block' : 'none' }}>
```

(Note: react-resizable-panels may not support this pattern — if not, store zoom/pan in Zustand and restore on remount.)

---

## Final Verdict

This is a competent MVP that needs accessibility work and state-handling polish before it's shippable. The architecture is sound, the code is clean, and the React Flow integration is done correctly at the foundation level. The main gaps are in the "last mile" — connecting loading states, adding keyboard support, and making dark mode actually work. Budget 2-3 days of focused work to address the critical and important issues.

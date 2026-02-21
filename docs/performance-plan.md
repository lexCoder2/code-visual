# Canvas Engine Performance Plan

> Audited: 2026-02-20  
> Scope: `layoutEngine.ts`, `graphStore.ts`, `App.tsx`, `GraphCanvas.tsx`, `graphVisuals.ts`, `useGraphController.ts`

---

## Findings

### 1. Critical: Double Force Simulation Per Data Change

Every call to `mergeExpansionPage`, `mergeExpansionBatch`, `setConnectionDepth`, etc. triggers `scheduleFrame` in the store, which runs `computeLayoutFrame` (full d3-force sim). That store state change then triggers a React re-render, which recomputes the `filteredLayoutFrame` useMemo in `App.tsx` — which also calls `computeLayoutFrame` with filtered data.

**Result: two full synchronous force simulations per data mutation.** The store's `frame` is used only for `depthById` derivation (~11 lines in App.tsx), yet costs a full sim run.

---

### 2. Critical: Synchronous Force Simulation Blocks Main Thread

`layoutEngine.ts` runs `min(240, max(120, nodes × 6))` simulation ticks inline. For 40+ visible nodes that locks at 240 ticks. d3-force's internal charge force (Barnes-Hut approximation) is O(n log n) per tick, making each full sim O(n log n × 240). On mobile or slow machines this blocks input events.

---

### 3. Critical: Animation RAF Cascade Recomputes O(V+E) Work Per Frame

During the 280 ms transition, `setRenderFrame` fires on every `requestAnimationFrame` (~16 calls). Each call re-renders the tree and reschedules all of these `useMemo` hooks:

| Memo                             | Cost                  | Depends on                        |
| -------------------------------- | --------------------- | --------------------------------- |
| `positionById`                   | O(nodes)              | `renderFrame.nodes`               |
| `loopBridgeNodeById`             | O(V+E)                | `renderFrame.edges`               |
| `adjacencyByNode`                | O(E)                  | `renderFrame.edges`               |
| `selectedRelativeNodeById`       | O(E)                  | `renderFrame.edges`               |
| `selectedRelativeEdgeById`       | O(E)                  | `renderFrame.edges`               |
| `nodeGeometryById` (GraphCanvas) | O(nodes) + math       | `frame.nodes`                     |
| `renderedEdges` (GraphCanvas)    | O(edges) + string ops | `frame.edges`, `nodeGeometryById` |

**7 memos × ~16 frames = ~112 recalculations per transition**, all O(V+E). The edges/geometry don't change during animation (only x/y positions interpolate), so this is entirely wasted work.

---

### 4. High: `filteredLayoutFrame` Invalidated by Viewport Pan/Zoom

```tsx
}, [graphState, nodeTypeFilters]);
```

`graphState` is the full Zustand store reference. Viewport pan and zoom mutate `graphState.viewport`, which is part of the same store object. Every pan event (`onCanvasPointerMove`) invalidates `filteredLayoutFrame`, running a full force simulation on mouse move.

---

### 5. High: `buildChildrenByParent` Redundant Rebuild Inside Engine

The store already maintains `childIdsByParent`. Inside `computeLayoutFrame` the BFS uses `adjacencyByNode` (built from `edgesById`, O(E)) and then `computeForcePositions` calls `buildChildrenByParent` which re-derives children from `parentByNodeId` (itself produced by BFS). The store's data is ignored in favour of two intermediate rebuilds.

---

### 6. Medium: Camera `useEffect` Re-runs During Every Animation Frame

```tsx
}, [focusedNodeId, motionSpeedFactor, positionById]);
```

`positionById` is a new object reference on every animation tick because it derives from `renderFrame.nodes`, which changes each RAF. The camera effect fires, checks `stopCameraAnimation`, then restarts — 16× per transition.

---

### 7. Medium: No Viewport Culling / Virtualization

All N nodes and E edges are rendered to the DOM unconditionally. No check against the viewport transform is performed. At zoom-out with 80+ nodes, all buttons and SVG paths are in the DOM and participate in layout/paint even if entirely offscreen.

---

### 8. Medium: Edge Rendering via Full SVG DOM Reconciliation

Each edge produces two `<path>` + optional `<text>` inside the SVG, all reconciled by React on every frame. String-building (`toFixed`) and perimeter math runs in `renderedEdges` on every animation tick. A canvas-drawn edge layer would skip React reconciliation entirely for the most volatile visual layer.

---

### 9. Low: Shallow Object Copies on All Store Mutations

```ts
const nextNodesById = { ...state.nodesById };
```

`mergeExpansionPage` and `mergeExpansionBatch` create a full shallow copy of `nodesById` and `edgesById` on every call. At 500+ nodes this allocates thousands of property slots per mutation and stresses GC.

---

### 10. Low: `getStructuredNodeLabel` Recreated per Render

Defined inside `GraphCanvas`, this function is a new closure on every render. Results are not cached despite label strings being stable across frames.

---

## Optimization Plan

### Tier 1 — Fix Render Budget (Highest ROI, no architectural change)

#### A. Stabilize animation-dependent memos

`loopBridgeNodeById`, `adjacencyByNode`, `selectedRelativeNodeById`, `selectedRelativeEdgeById`, and `nodeGeometryById` should depend on `filteredLayoutFrame` (the stable layout target), **not** `renderFrame` (the animated interpolation). Only positions `x/y` change during animation — topology and depths are fixed.

- Move these five memos to depend on `filteredLayoutFrame.edges` / `filteredLayoutFrame.nodes`
- The render function still reads positions from `renderFrame` for smoothness
- The derived graph-structure lookups stay stable across the 280 ms transition

#### B. Decouple `positionById` from camera effect

Store the `filteredLayoutFrame` target positions in a `useRef` and read them directly inside the camera `useEffect`. Remove `positionById` from the effect's dependency array. The camera target position only needs to be recalculated when `focusedNodeId` changes, not on every animation tick.

```tsx
const layoutFrameRef = useRef(filteredLayoutFrame);
layoutFrameRef.current = filteredLayoutFrame;

useEffect(() => {
  const focusPosition = layoutFrameRef.current.nodes.find(
    (n) => n.id === focusId,
  );
  // ...
}, [focusedNodeId, motionSpeedFactor]); // positionById removed
```

#### C. Narrow `filteredLayoutFrame` dependencies

Replace `[graphState, nodeTypeFilters]` with explicit field selectors so viewport mutations do not invalidate the layout:

```tsx
}, [
  graphState.nodesById,
  graphState.edgesById,
  graphState.childIdsByParent,
  graphState.manualPositions,
  graphState.focusedNodeId,
  graphState.rootNodeId,
  graphState.connectionDepth,
  graphState.siblingPageByParent,
  nodeTypeFilters,
]);
```

---

### Tier 2 — Eliminate Redundant Work

#### D. Remove the store's `frame` field; make `filteredLayoutFrame` the single layout source

`graphState.frame` in the store is used only to derive `depthById` in App.tsx. Remove `scheduleFrame` and the `frame` field from the store entirely. Derive `depthById` from `filteredLayoutFrame.nodes` instead. This eliminates one complete force simulation per data mutation.

```tsx
// App.tsx — replace:
const depthById = useMemo(() => {
  const map: Record<string, number> = {};
  graphState.frame.nodes.forEach((node) => {
    map[node.id] = node.depth;
  });
  return map;
}, [graphState.frame.nodes]);

// With:
const depthById = useMemo(() => {
  const map: Record<string, number> = {};
  filteredLayoutFrame.nodes.forEach((node) => {
    map[node.id] = node.depth;
  });
  return map;
}, [filteredLayoutFrame.nodes]);
```

#### E. Skip the `buildChildrenByParent` rebuild in the engine

`computeLayoutFrame` already receives `childIdsByParent` from the store. Pass it directly to `buildTargetAngleById` and `computeForcePositions`, removing the per-call `parentByNodeId → buildChildrenByParent` round-trip.

```ts
// layoutEngine.ts — pass childIdsByParent directly:
const targetAngleById = buildTargetAngleById({
  rootNodeId,
  childrenByParent: childIdsByParent, // use store data directly
});
```

#### F. Maintain `adjacencyByNode` index in the store

Add `adjacencyByNode: Record<string, string[]>` to the Zustand store and update it incrementally inside `mergeExpansionPage` / `mergeExpansionBatch`. Replace the three independent O(E) rebuild sites (layoutEngine, App.tsx two memos, drag propagation) with the single pre-built index.

```ts
// graphStore.ts — add to state:
adjacencyByNode: Record<string, string[]>;

// Update incrementally in mergeExpansionPage:
const nextAdjacency = { ...state.adjacencyByNode };
children.forEach((child) => {
  nextAdjacency[parentId] = [...(nextAdjacency[parentId] ?? []), child.id];
  nextAdjacency[child.id] = [...(nextAdjacency[child.id] ?? []), parentId];
});
```

---

### Tier 3 — Structural Performance

#### G. Move force simulation to a Web Worker

Extract `computeForcePositions` into a dedicated Worker file. Communication protocol:

```
Main → Worker:  { type: "LAYOUT", nodes: ForceNodeInput[], links: ForceLink[], config: LayoutConfig }
Worker → Main:  { type: "POSITIONS", positionedById: Record<string, {x,y}> }
```

- Post the graph topology once when data changes
- Receive positions once when the sim converges
- The main thread initiates layout and is never blocked
- Manual drag positions are applied on the main thread before posting to the worker

```ts
// layoutWorker.ts
self.addEventListener("message", (event) => {
  const { nodes, links, config } = event.data;
  const positions = runForceSimulation(nodes, links, config);
  self.postMessage({ type: "POSITIONS", positionedById: positions });
});
```

#### H. Draw edges on a `<canvas>` layer

Replace the SVG edge subtree with a single `<canvas>` element. Since edges have no interactive hit-target need, React reconciliation for edges is eliminated entirely.

```tsx
// EdgeCanvas.tsx
function EdgeCanvas({ edges, nodeGeometryById, depthById, selectedRelativeEdgeById }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS.width, CANVAS.height);
    edges.forEach(edge => {
      // draw glow pass
      // draw stroke pass
      ctx.bezierCurveTo(...);
    });
  }); // no deps — runs on every RAF already driving node positions

  return <canvas ref={canvasRef} width={CANVAS.width} height={CANVAS.height} className="edges-canvas" />;
}
```

This removes ~2E DOM nodes from React's tree and eliminates all `renderedEdges` useMemo work.

#### I. Viewport culling

Before rendering each node and before drawing each edge, check if the bounding box intersects the visible viewport rectangle derived from `viewport.x`, `viewport.y`, `viewport.scale` and canvas dimensions.

```tsx
function isVisible(
  x: number,
  y: number,
  halfW: number,
  halfH: number,
  vp: ViewportState,
  canvasW: number,
  canvasH: number,
): boolean {
  const left = (x - halfW) * vp.scale + vp.x;
  const right = (x + halfW) * vp.scale + vp.x;
  const top = (y - halfH) * vp.scale + vp.y;
  const bottom = (y + halfH) * vp.scale + vp.y;
  return right >= 0 && left <= canvasW && bottom >= 0 && top <= canvasH;
}

// In node render loop:
if (
  !isVisible(
    node.x,
    node.y,
    halfW,
    halfH,
    viewport,
    CANVAS.width,
    CANVAS.height,
  )
)
  return null;
```

At typical zoom levels with large graphs this can reduce rendered nodes by 60–80%.

---

### Tier 4 — Secondary Cleanup

#### J. Structural sharing in store with Immer

Add `immer` middleware to the Zustand store. Replace all `{ ...state.nodesById, [id]: ... }` patterns with `draft.nodesById[id] = ...`. Immer uses structural sharing so unmodified subtrees are not re-allocated.

```ts
import { immer } from "zustand/middleware/immer";

export const useGraphStore = create<GraphStore>()(
  immer((set, get) => ({
    // ...
    mergeExpansionPage({ parentId, total, page, children }) {
      set((draft) => {
        children.forEach((child) => {
          draft.nodesById[child.id] ??= createNode(child, parentId);
          draft.adjacencyByNode[parentId] ??= [];
          draft.adjacencyByNode[parentId].push(child.id);
          // ...
        });
      });
    },
  })),
);
```

#### K. Cache `getStructuredNodeLabel` results

Move the function outside `GraphCanvas` and memoize results in a `Map<string, StructuredLabel>` keyed by `label + ":" + kind`. Graph labels are stable across renders.

```ts
const labelCache = new Map<string, StructuredLabel>();

export function getStructuredNodeLabel(
  label: string,
  kind: string,
): StructuredLabel {
  const key = `${label}:${kind}`;
  const cached = labelCache.get(key);
  if (cached) return cached;
  const result = computeStructuredLabel(label, kind);
  labelCache.set(key, result);
  return result;
}
```

#### L. Ease-in-out interpolation in animation loop

Replace linear `k = t` in the animation loop with a cubic ease-in-out:

```ts
// Replace:
const k = t;

// With:
const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
```

Node movements will feel noticeably smoother at zero computational cost.

#### M. CSS rendering hints

```css
.graph-layer {
  will-change: transform;
  contain: layout style;
}

.node {
  will-change: transform, opacity;
  contain: layout style paint;
}

.canvas {
  contain: strict;
}
```

These let the compositor promote layers and skip layout recalculation for the rest of the page on every pan/zoom frame.

---

## Complexity Summary

| Area                                  | Current               | After                          |
| ------------------------------------- | --------------------- | ------------------------------ |
| Force sim calls per mutation          | 2 full sims           | 1 sim (D)                      |
| Memo recomputes per animation frame   | 7 × O(V+E)            | 1 × O(nodes) position-only (A) |
| Viewport pan sim trigger              | Yes (whole store dep) | No (C)                         |
| Main thread blocking per sim          | 50–120 ms             | 0 ms (G)                       |
| DOM nodes per edge                    | 2–3                   | 0 (H)                          |
| Nodes rendered offscreen              | All                   | 0 (I)                          |
| Store mutation alloc                  | Full shallow copy     | Structural share (J)           |
| Camera effect restarts per transition | ~16                   | 1 (B)                          |

---

## Implementation Order

```
A → C → B → D → E → F → L → M → G → H → I → J → K
```

- **A, C, B** — pure dependency rewiring, zero risk, immediate gains
- **D** — follows naturally once A–C are stable (removes store `frame` + `scheduleFrame`)
- **E, F** — index cleanup, safe refactors
- **L, M** — zero-risk polish
- **G** — largest change, requires Worker infra; do after D–F are stable
- **H** — canvas edge layer; do after G so edge positions come from worker output
- **I** — viewport culling; add last so the full node list is confirmed correct first
- **J** — Immer middleware; add after all mutation sites are stable
- **K** — label cache; final micro-optimization

---

## Files Affected

| File                             | Changes                                                        |
| -------------------------------- | -------------------------------------------------------------- |
| `src/App.tsx`                    | A, B, C, D, I (node culling in render)                         |
| `src/state/graphStore.ts`        | D (remove frame/scheduleFrame), F (adjacencyByNode), J (Immer) |
| `src/lib/layoutEngine.ts`        | E (pass childIdsByParent directly), G (extract sim to worker)  |
| `src/components/GraphCanvas.tsx` | H (EdgeCanvas), I (culling), K (label cache)                   |
| `src/lib/layoutWorker.ts`        | G (new file — Worker entry point)                              |
| `src/components/EdgeCanvas.tsx`  | H (new file — canvas edge renderer)                            |
| `src/lib/graphVisuals.ts`        | K (move + cache getStructuredNodeLabel)                        |
| `src/App.css`                    | M (will-change, contain)                                       |

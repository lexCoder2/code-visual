# Code Visual

Interactive Memgraph project visualizer with scalable state management and performance-focused graph rendering.

## Core Features

- Project list retrieval from database (or mock fallback)
- Project selection and graph root initialization
- Auto-refresh every 5 seconds
- Interactive graph navigation with pan + zoom
- Depth-limited traversal (configurable 1–4 levels)
- Sibling capping (max 20 visible siblings per parent)
- Sibling paging (Prev/Next) for large fan-out
- Frame precomputation before render (`requestAnimationFrame` layout pipeline)
- In-canvas modular controls with neumorphic + glass styling

## Architecture

- `src/lib/memgraphClient.ts`: Memgraph access layer with live/mock modes
- `src/state/graphStore.ts`: Zustand graph/UI store and render frame scheduler
- `src/lib/layoutEngine.ts`: deterministic visibility + layout computation
- `src/hooks/useGraphController.ts`: orchestration for querying, polling, and expansion
- `src/components/controls/`: modular control components rendered as in-canvas overlay
- `src/App.tsx`: UI and interaction layer

## Configuration

Set one of these frontend env vars:

- `VITE_MEMGRAPH_URL`
- `VITE_MEMGRAPH_ENDPOINT`
- `VITE_MEMGRAPH_URI`

Example:

```bash
VITE_MEMGRAPH_URL=http://localhost:4000/query
```

Bolt protocol support is provided through a local proxy server:

```bash
MEMGRAPH_BOLT_URL=bolt://localhost:7687
# Optional auth
MEMGRAPH_BOLT_USER=
MEMGRAPH_BOLT_PASSWORD=
MEMGRAPH_PROXY_PORT=4000
```

Run in separate terminals:

```bash
npm run proxy
npm run dev
```

Or run both together:

```bash
npm run dev:all
```

`VITE_MEMGRAPH_URL` should point to the proxy endpoint (default: `http://localhost:4000/query`).

If the endpoint is `http(s)://`, the app sends POST requests with:

Request shape:

```json
{
  "query": "<cypher>",
  "params": {}
}
```

Expected response formats supported:

- `Array<Record<string, unknown>>`
- `{ "results": [...] }`
- `{ "data": [...] }`
- `{ "rows": [...] }`

If no endpoint is configured, the app runs in mock mode.

## Scripts

- `npm run dev`: start development server
- `npm run build`: type-check + build
- `npm run lint`: lint project
- `npm run preview`: preview production build

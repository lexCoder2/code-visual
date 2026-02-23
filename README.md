# lxRAG Visual Explorer

Visual UI for exploring the graph generated and served by [lxRAG MCP](https://github.com/lexCoder2/lxRAG-MCP).

<p align="center">
	<img alt="Vite" src="https://img.shields.io/badge/Vite-8-blueviolet" />
	<img alt="React" src="https://img.shields.io/badge/React-19-61DAFB" />
	<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6" />
	<img alt="License" src="https://img.shields.io/badge/License-MIT-green" />
</p>

<p align="center">
	<img src="docs/image.png" alt="lxRAG Visual Explorer screenshot" width="760" />
</p>

---

## What this project is

This repository is the **visual companion** to lxRAG MCP.  
It gives you an interactive graph canvas for browsing projects, dependencies, neighborhoods, and architecture shape backed by Memgraph.

Use it together with the MCP server:

- lxRAG MCP handles indexing, retrieval, and the 38-tool intelligence surface.
- This app handles fast visual exploration and graph navigation.

## Relationship to lxRAG MCP

- **lxRAG MCP**: graph + vector intelligence layer, session/tool workflows, indexing (`graph_rebuild`, `init_project_setup`, `graph_health`, etc.)
- **lxRAG Visual Explorer (this repo)**: frontend + lightweight proxy to render and navigate that graph visually

Main MCP repo: [https://github.com/lexCoder2/lxRAG-MCP](https://github.com/lexCoder2/lxRAG-MCP)

## Features

- Interactive canvas for large graph navigation (pan/zoom/drag/select)
- Expand-by-depth and per-node neighborhood exploration
- Live mode + mock mode fallback for resilient local development
- Semantic/structure-aware rendering for clearer architecture reading
- Responsive graph layout pipeline with worker-assisted updates

## Quick start (this repo)

```bash
npm install
cp .env.example .env
npm run dev:all
```

Open [http://localhost:5173](http://localhost:5173).

## Connect with lxRAG MCP

1. Set up and run lxRAG MCP (see its [QUICK_START.md](https://github.com/lexCoder2/lxRAG-MCP/blob/main/QUICK_START.md)).
2. Make sure Memgraph is reachable from this project.
3. Point this app to the proxy endpoint via `VITE_MEMGRAPH_URL` (default: `http://localhost:4000/query`).
4. Start this app with `npm run dev:all`.

If lxRAG MCP and this app share the same Memgraph instance, the visual graph reflects the same indexed project data.

## Environment

From `.env.example`:

| Variable                 | Default                       | Purpose                   |
| ------------------------ | ----------------------------- | ------------------------- |
| `VITE_MEMGRAPH_URL`      | `http://localhost:4000/query` | Frontend query endpoint   |
| `MEMGRAPH_BOLT_URL`      | `bolt://localhost:7687`       | Proxy → Memgraph Bolt URL |
| `MEMGRAPH_BOLT_USER`     | _(empty)_                     | Bolt username             |
| `MEMGRAPH_BOLT_PASSWORD` | _(empty)_                     | Bolt password             |
| `MEMGRAPH_PROXY_PORT`    | `4000`                        | Local proxy port          |

Optional compatibility toggle used by the frontend:

- `VITE_MEMGRAPH_SCHEMA_MODE=full|legacy` (defaults to `full` when unset)

## Scripts

- `npm run dev` — Vite dev server
- `npm run proxy` — Memgraph proxy server
- `npm run dev:all` — proxy + frontend together
- `npm run build` — TypeScript build + Vite production build
- `npm run lint` — ESLint
- `npm run preview` — local preview of production build

## Interaction basics

- Right-drag canvas to pan
- Mouse wheel to zoom around pointer
- Click node to select
- Double-click node to expand neighbors
- Drag node to reposition local structures

## Architecture

- Frontend: React + TypeScript + Vite
- State: Zustand + Immer
- Layout/rendering: force layout + worker-assisted updates
- Data path: `Memgraph -> local proxy -> graph store -> layout engine -> canvas`

See:

- [docs/architecture.md](docs/architecture.md)
- [docs/performance-plan.md](docs/performance-plan.md)

## Troubleshooting

- Empty/disconnected graph: verify `MEMGRAPH_BOLT_URL` and that Memgraph is running
- Proxy/CORS errors: start proxy with `npm run proxy` or `npm run dev:all`
- Slow interaction on dense graphs: reduce depth and narrow visible scope
- Build issues: run `npm install` then `npm run build`

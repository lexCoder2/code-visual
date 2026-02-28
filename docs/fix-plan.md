# Fix Plan — lxRAG Tool Errors

**Source:** Audits run A–D (2026-02-22 / 2026-02-23)  
**Audit docs:** [run A](lxrag-tool-audit-2026-02-22.md) · [run B](lxrag-tool-audit-2026-02-23.md) · [run C](lxrag-tool-audit-2026-02-23b.md) · [run D](lxrag-tool-audit-2026-02-23c.md)

Issues split by repo:
- **lxRAG-MCP** — bugs in the MCP server (`https://github.com/lexCoder2/lxRAG-MCP`)
- **lexRAG-visual** — config or code gaps in this repo

---

## Scope & Ownership

| # | Area | Repo | Priority |
|---|---|---|---|
| 1 | Embedding pipeline never writes to Qdrant | lxRAG-MCP | P0 |
| 2 | Tool surface changes between sessions | lxRAG-MCP | P0 |
| 3 | FILE.path normalization split (6 relative, 22 absolute) | lxRAG-MCP | P1 |
| 4 | SECTION.relativePath always null | lxRAG-MCP | P1 |
| 5 | In-memory cache not fully synced after rebuild | lxRAG-MCP | P1 |
| 6 | `arch_validate` silently drops relative-path files | lxRAG-MCP | P1 |
| 7 | `impact_analyze` includes changed file in directImpact | lxRAG-MCP | P2 |
| 8 | `test_run` uses system Node.js v10 instead of project env | lxRAG-MCP | P2 |
| 9 | `episode_add` disabled-check fires after schema validation | lxRAG-MCP | P2 |
| 10 | `contract_validate` schema registry is stale | lxRAG-MCP | P2 |
| 11 | `context_pack` returns empty without embeddings | lxRAG-MCP | P2 |
| 12 | `arch_suggest` always returns `src/types/` layer | lxRAG-MCP | P2 |
| 13 | COMMUNITY detection uses path-segment tokenizing | lxRAG-MCP | P2 |
| 14 | `find_pattern(circular)` not implemented | lxRAG-MCP | P3 |
| 15 | No `.lxrag/config.json` in this repo | lexRAG-visual | P1 |
| 16 | No test files — `test_run` always reports 0 | lexRAG-visual | P3 |

---

## P0 — Blocking all semantic features

### Fix 1 — Embedding pipeline write path

**Problem:** `index_docs(withEmbeddings=true)` and `graph_rebuild` silently do not write vectors to Qdrant. `graph_health` confirms Qdrant is connected and `embeddings.ready: true`, but `embeddings.generated` stays at 0 after every build. All 7 semantic tools (`semantic_search`, `code_explain`, `find_similar_code`, `code_clusters`, `semantic_slice`, `semantic_diff`, `context_pack`) fail with "No indexed symbols found."

**Repo:** lxRAG-MCP  
**Likely location:** indexer / `DocsEngine` or `GraphBuilder` embedding step, Qdrant write client

**Steps:**
1. Find the embedding generation step — search for where `embeddings.generated` counter is incremented
2. Trace whether the Qdrant write client is actually called and whether it receives any payloads
3. Check if the embedding model/endpoint is configured (the `summarizer.configured: false` field suggests no LLM endpoint is set — confirm whether embeddings require the same endpoint or a separate one)
4. If embeddings require an external model endpoint: document the required env var (e.g., `LXRAG_EMBED_ENDPOINT`) and add a clear health warning when it is not set
5. If embeddings are supposed to be local (e.g., via `fastembed` or similar): ensure the dependency is installed and the write path is called
6. Fix `graph_health` to accurately report: `"Embeddings not generated — set LXRAG_EMBED_ENDPOINT or install embedding dependency"` instead of `"Embeddings complete"` when `generated = 0`

**Validation:**
```
index_docs(withEmbeddings=true)
graph_health → embeddings.generated > 0
semantic_search(query='React component rendering') → ≥1 result
```

---

### Fix 2 — Tool surface stability

**Problem:** The set of available tools changes every session. `graph_query`, `index_docs`, `arch_suggest`, and `ref_query` were available in runs A–C and absent in run D. `blocking_issues` appeared only in run C. No session has a stable, additive tool surface.

**Repo:** lxRAG-MCP  
**Likely location:** MCP server tool registration / feature-flag or license-tier gating logic

**Steps:**
1. Identify what controls tool enable/disable — check if it is environment variables, config file, license tier, or a feature flag store
2. Determine why tools randomly disappear between sessions (restart, config reload, race condition?)
3. Add `tools_list` endpoint (or extend `graph_health`) to return the currently active tool manifest so agents can introspect before calling
4. Ensure the tool set is fully stable across consecutive sessions for a given config
5. If gating is intentional (e.g., by plan/tier), document which tools are in which tier and surface this in the disabled error message

**Validation:**
- Start two sessions one hour apart with the same config → identical tool list both times
- `graph_health` response includes an `availableTools` array

---

## P1 — Data integrity issues

### Fix 3 — FILE.path normalization

**Problem:** 6 of 28 indexed files receive relative paths (`src/components/EdgeCanvas.tsx`) while 22 receive absolute paths (`/home/alex_rod/projects/code-visual/src/App.tsx`). The 6 relative-path files are: `src/lib/graphVisuals.ts`, `src/lib/layoutEngine.ts`, `src/components/EdgeCanvas.tsx`, `src/components/controls/ArchitectureControls.tsx`, `src/components/controls/RefreshToggleControl.tsx`, `src/config/constants.ts`.

**Repo:** lxRAG-MCP  
**Likely location:** `GraphBuilder` / file parser path resolution step

**Steps:**
1. Find where `FILE.path` is written — locate the node creation call in the graph builder
2. Identify why these 6 files receive a relative path (likely they are discovered via a different code path than the 22 absolute-path files — possibly imported via relative specifiers vs. direct directory walk)
3. At write time, resolve all paths to absolute using `path.resolve(workspaceRoot, filePath)` before creating the node
4. Add a post-build assertion: `MATCH (f:FILE) WHERE NOT f.path STARTS WITH '/' RETURN count(f)` must return 0
5. Fix derived FUNCTION/CLASS/VARIABLE node IDs — they currently omit the folder segment for relative-path files (e.g., `lexRAG-visual:ArchitectureControls.tsx:fn` instead of `lexRAG-visual:components/controls/ArchitectureControls.tsx:fn`)

**Validation:**
```cypher
MATCH (f:FILE) WHERE NOT f.path STARTS WITH '/' RETURN count(f)
-- must return 0
```

---

### Fix 4 — SECTION.relativePath always null

**Problem:** `index_docs` creates 265 SECTION nodes. All have `relativePath = NULL`. Parent DOCUMENT nodes correctly have `relativePath` (e.g., `docs/architecture.md`). The path is dropped when creating SECTION children.

**Repo:** lxRAG-MCP  
**Likely location:** `DocsEngine` / section node write step

**Steps:**
1. Find the SECTION node creation call in DocsEngine
2. The DOCUMENT node is created first with `relativePath` populated — pass `document.relativePath` as a parameter to the SECTION write call
3. Add it to the Cypher MERGE/CREATE statement: `SET s.relativePath = $relativePath`
4. Re-run `index_docs` and verify: `MATCH (s:SECTION) WHERE s.relativePath IS NULL RETURN count(s)` returns 0

**Validation:**
```cypher
MATCH (s:SECTION) WHERE s.relativePath IS NULL RETURN count(s)
-- must return 0
```

---

### Fix 5 — In-memory cache not fully synced after rebuild

**Problem:** `graph_health` shows `driftDetected: true` immediately after a full rebuild with no other changes. Run D: `cachedNodes: 234` vs `memgraphNodes: 900`. The cache is partially populated (26%) but the drift flag never clears.

**Repo:** lxRAG-MCP  
**Likely location:** graph rebuild completion handler / cache synchronization step

**Steps:**
1. Find where `cachedNodes` is populated — likely a post-build step that reads from Memgraph into an in-memory store
2. Determine why only 234 of 900 nodes are cached — is there a batch size limit, timeout, or early return?
3. Ensure the cache sync runs to completion before the rebuild transaction is marked done
4. After cache sync, update `driftDetected: false` — only set true if Memgraph data changes after the last cache sync
5. If cache sync is async, add a `rebuilding` or `syncing` status to `graph_health` so callers can wait rather than seeing misleading "out of sync" warnings

**Validation:**
```
graph_health(debug) immediately after graph_rebuild(full)
→ cachedNodes == memgraphNodes
→ driftDetected: false
```

---

### Fix 6 — `arch_validate` silently drops relative-path files

**Problem:** When all input files use relative paths, `arch_validate` processes fewer files than provided. `filesChecked` counts correctly but individual file results are missing. Example: 3 files input, 2 violations output, `graphVisuals.ts` absent.

**Repo:** lxRAG-MCP  
**Likely location:** `arch_validate` handler — file lookup loop

**Steps:**
1. Find the loop that iterates over input files and generates violation entries
2. Identify the lookup that fails for relative-path inputs (likely a graph query comparing `f.path = $inputPath` that only matches absolute paths)
3. For each input file: normalize to absolute using `workspaceRoot` join before querying, OR query using both `f.path = $abs` OR `f.path = $rel` to handle both formats
4. Ensure every input file produces exactly one output entry — either a named violation or a `{ file, layer, status: "clean" }` entry
5. Remove the silent skip — if a file cannot be resolved at all, emit `{ file, status: "not-indexed", suggestion: "Run graph_rebuild first" }`

**Validation:**
- Input 3 relative-path files → 3 entries in violations/results array
- `statistics.filesChecked` == length of output entries

---

### Fix 15 — Create `.lxrag/config.json` for this repo

**Problem:** No `.lxrag/config.json` exists. `arch_validate` returns `layer: unknown` for all files. `arch_suggest` falls back to a broken default (always returns `src/types/`).

**Repo:** lexRAG-visual  
**Action:** Create the file at `/home/alex_rod/projects/code-visual/.lxrag/config.json`

**Content:**
```json
{
  "projectId": "lexRAG-visual",
  "layers": [
    {
      "id": "components",
      "name": "Components",
      "paths": ["src/components/**", "src/assets/**"],
      "canImport": ["hooks", "state", "lib", "types", "config"],
      "description": "React UI components"
    },
    {
      "id": "hooks",
      "name": "Hooks",
      "paths": ["src/hooks/**"],
      "canImport": ["state", "lib", "types", "config"],
      "description": "React custom hooks"
    },
    {
      "id": "state",
      "name": "State",
      "paths": ["src/state/**"],
      "canImport": ["lib", "types", "config"],
      "description": "Zustand stores"
    },
    {
      "id": "lib",
      "name": "Lib",
      "paths": ["src/lib/**"],
      "canImport": ["types", "config"],
      "description": "Pure utilities, clients, and engines"
    },
    {
      "id": "types",
      "name": "Types",
      "paths": ["src/types/**"],
      "canImport": [],
      "description": "TypeScript type definitions"
    },
    {
      "id": "config",
      "name": "Config",
      "paths": ["src/config/**"],
      "canImport": [],
      "description": "Static constants and configuration"
    }
  ]
}
```

**Validation:**
- `arch_validate(["/home/.../src/App.tsx"])` → `layer: components` (or root), not `unknown`
- `arch_suggest(type="service", dependencies=["neo4j-driver"])` → suggests `src/lib/`

---

## P2 — Correctness and reliability bugs

### Fix 7 — `impact_analyze` self-reference in directImpact

**Problem:** When `changedFiles` includes `src/lib/graphVisuals.ts`, the same file appears in `directImpact`. The changed file is importing itself (or a circular REFERENCES edge exists).

**Repo:** lxRAG-MCP  
**Likely location:** impact_analyze traversal result assembly

**Steps:**
1. After collecting `directImpact` via graph traversal, filter out any path that matches an entry in `changedFiles`
2. Normalize both sets to absolute paths before comparison (the split between absolute and relative paths causes missed de-duplication)
3. Also check whether any REFERENCES self-loops exist: `MATCH (f:FILE)-[:IMPORTS]->(i:IMPORT)-[:REFERENCES]->(f) RETURN f.path` — these should be cleaned up at index time

**Validation:**
```
impact_analyze(files=["src/lib/graphVisuals.ts"])
→ directImpact does NOT contain "src/lib/graphVisuals.ts"
```

---

### Fix 8 — `test_run` uses wrong Node.js version

**Problem:** `test_run` forks `npx vitest run` using the system's Node.js v10.19.0. The project requires Node.js ≥18. The system node path is hardcoded or resolved from a PATH that does not reflect the user's active runtime (e.g., nvm, fnm, mise).

**Repo:** lxRAG-MCP  
**Likely location:** `test_run` child process spawn call

**Steps:**
1. Find the `child_process.spawn` or `exec` call in the test_run handler
2. Replace the hardcoded `node` / `npm` / `npx` binary with a runtime-resolved path:
   - Option A: read `process.env.PATH` at invocation time and resolve `npx` from it
   - Option B: accept an optional `nodeBin` parameter in `test_run` to let the caller override
   - Option C: spawn the command inside the user's shell (`sh -c "npx vitest run ..."`) so shell profile / nvm is respected
3. Fix the `testsRun` counter — it currently counts the vitest process invocation (1) instead of actual test cases (0). Parse vitest JSON output to get the real count.

**Validation:**
```
test_run(testFiles=["src"])
→ no "npm is known not to run on Node.js v10" error
→ testsRun: 0 (no test files exist yet)
```

---

### Fix 9 — `episode_add` disabled-check order and enum error message

**Problem:** Schema validation fires before the tool-disabled check, so different `type` values produce different error messages for the same disabled tool. The allowed `type` values are not listed in the error.

**Repo:** lxRAG-MCP  
**Likely location:** MCP tool middleware stack / request validation pipeline

**Steps:**
1. Move the tool-disabled check to the first middleware position, before any schema validation
2. When the disabled check fails, always return: `{ error: "Tool <name> is currently disabled" }` regardless of whether params are valid
3. In enum validation errors, include: `"allowedValues": ["value1", "value2", ...]` in the error payload
4. Update `contract_validate` schema registry to match the actual allowed `type` values for `episode_add`

---

### Fix 10 — `contract_validate` stale schema registry

**Problem:** `contract_validate` reports args as valid that the actual tool rejects (`search_docs` rejects `profile`; `episode_add` rejects `type="observation"`). The normalisation layer has a different schema than the live tool handlers.

**Repo:** lxRAG-MCP  
**Likely location:** `contract_validate` input spec definitions

**Steps:**
1. Identify where `contract_validate` stores its per-tool schemas (likely a static object or separate schema file)
2. Diff each schema against the actual MCP tool JSON schema definitions
3. Remove `profile` from `search_docs` schema in the registry (it is not accepted by that tool)
4. Update `episode_add` with the correct enum values for `type`
5. Add a CI check or test that `contract_validate` schemas are derived from the same source as the MCP tool schemas, not maintained separately

---

### Fix 11 — `context_pack` falls back to empty without embeddings

**Problem:** `context_pack` resolves entry points and `coreSymbols` via vector search. When `embeddings.generated = 0`, it returns a fully empty briefing with a static placeholder: `"Plan-node integration deferred to later phase."`

**Repo:** lxRAG-MCP  
**Likely location:** `context_pack` handler — entry point resolution step

**Steps:**
1. Add a Cypher-based fallback for entry point resolution when vectors are unavailable:
   - Entry point = file with the most outgoing `IMPORTS` edges, or file named `main.tsx` / `App.tsx`
   - Core symbols = FUNCTION nodes with the most `CONTAINS` parent relationships
2. Replace the static `plan.note` placeholder with a live status: if no task exists with `taskId`, return `null` instead of the placeholder string
3. Emit a `warning` field in the response when falling back to Cypher mode: `"Semantic resolution unavailable — embeddings not generated. Using structural fallback."`

---

### Fix 12 — `arch_suggest` always returns `src/types/` layer

**Problem:** `arch_suggest` ignores the `type` parameter and always returns the `Types` layer with an empty `reasoning` string. Tested with `type=service`, `type=component`, different `dependencies`.

**Repo:** lxRAG-MCP  
**Likely location:** `arch_suggest` handler — layer selection logic

**Steps:**
1. Find the layer selection code — there should be a mapping from `type` → candidate layers
2. The selector appears to always return the first layer in the config (which is `types`) — fix the selection to use the `type` param:
   - `service` → prefer `lib` layer
   - `component` → prefer `components` layer
   - `hook` → prefer `hooks` layer
   - `store` → prefer `state` layer
3. Populate the `reasoning` string — it is currently always empty. It should explain why the layer was chosen (e.g., `"'lib' is the standard layer for services with external dependencies [neo4j-driver]"`)
4. Fix name deduplication: if input name is `GraphDataService` and type is `service`, do not append `Service` suffix again → output should be `src/lib/GraphDataService.ts` not `src/lib/GraphDataServiceService.ts`

---

### Fix 13 — COMMUNITY detection uses path-segment tokenizing

**Problem:** Community labels are derived from path tokens of absolute file paths. Community "home" comes from `/home/alex_rod/...`. Single-file communities exist for `memgraphClient.ts` and `graphVisuals.ts`. `COMMUNITY.size` is always null.

**Repo:** lxRAG-MCP  
**Likely location:** community detection step in `GraphBuilder`

**Steps:**
1. Replace path-segment tokenizing with structural community detection using the import graph:
   - Use Louvain or label propagation on the `IMPORTS/REFERENCES` subgraph
   - OR group by source directory (relative to `workspaceRoot`) which is already meaningful: `components/controls`, `lib`, `state`, `hooks`
2. Write `COMMUNITY.size` = number of member FILE nodes at creation time
3. Ensure the community label is derived from the shared directory, not a path token from an absolute path

---

## P3 — Low-priority and documentation gaps

### Fix 14 — `find_pattern(circular)` not implemented

**Problem:** Returns `{ status: "not-implemented" }`.

**Repo:** lxRAG-MCP  
**Steps:**
1. Implement circular dependency detection using the `IMPORTS/REFERENCES` graph:
   ```cypher
   MATCH path = (f:FILE)-[:IMPORTS|REFERENCES*2..10]->(f)
   RETURN [n IN nodes(path) | n.path] AS cycle
   ```
2. Return each cycle as a `match` entry with `files`, `cycle_length`, and `severity`

---

### Fix 16 — No test files in lexRAG-visual

**Problem:** `test_run` always reports `testsRun: 0` and blast radius is always 0%. The entire test intelligence surface of lxRAG is untestable against this repo.

**Repo:** lexRAG-visual  
**Steps:**
1. Add at minimum one unit test file for a pure utility function (e.g., a helper in `src/lib/graphVisuals.ts`)
2. Suggested: `src/lib/__tests__/graphVisuals.test.ts` using Vitest
3. Add `vitest` to `devDependencies` if not already present (check `package.json`)
4. Add a `test` script to `package.json`: `"test": "vitest run"`

---

## Execution Order

```
Phase 1 (unblock everything):
  Fix 1 — embedding pipeline     ← unblocks semantic_search, code_explain, find_similar_code,
                                     code_clusters, context_pack, semantic_diff, semantic_slice
  Fix 2 — tool stability          ← required for any reliable multi-session workflow
  Fix 15 — .lxrag/config.json    ← can be done now, unblocks arch_validate + arch_suggest

Phase 2 (data integrity):
  Fix 3 — FILE.path normalization  ← fixes 6 broken files; required before Fix 4 and Fix 6 are verifiable
  Fix 4 — SECTION.relativePath    ← unblocks search_docs result tracing
  Fix 5 — cache sync              ← fixes misleading health status
  Fix 6 — arch_validate silent drop

Phase 3 (correctness):
  Fix 7  — impact_analyze self-reference
  Fix 8  — test_run Node.js version
  Fix 9  — episode_add disabled order
  Fix 10 — contract_validate schema drift
  Fix 11 — context_pack Cypher fallback
  Fix 12 — arch_suggest layer logic
  Fix 13 — COMMUNITY detection

Phase 4 (completeness):
  Fix 14 — find_pattern circular
  Fix 16 — add test files to lexRAG-visual
```

---

## Validation Plan

After all phases complete, run a fresh clean audit:

```
1. graph_rebuild(full)
2. graph_health(debug)
   → bm25IndexExists: true
   → embeddings.generated > 0
   → driftDetected: false
   → cachedNodes == memgraphNodes

3. MATCH (f:FILE) WHERE NOT f.path STARTS WITH '/' RETURN count(f)  → 0
4. MATCH (s:SECTION) WHERE s.relativePath IS NULL RETURN count(s)   → 0
5. MATCH (c:COMMUNITY) WHERE c.size IS NULL RETURN count(c)         → 0

6. arch_validate([src/App.tsx, src/hooks/useGraphController.ts])     → no "unknown" layers
7. arch_suggest(type='service', deps=['neo4j-driver'])               → path under src/lib/
8. impact_analyze(files=['src/lib/graphVisuals.ts'])                 → directImpact ≠ contains graphVisuals.ts
9. graph_query(language='natural', 'React component graph rendering') → ≥1 result
10. semantic_search(query='Zustand state management')                → ≥1 result
11. context_pack(task='graph rendering')                             → entryPoint set, coreSymbols ≠ []
12. test_run([src])                                                  → no Node.js version error, testsRun ≥ 1

13. Two fresh sessions → identical tool lists
```

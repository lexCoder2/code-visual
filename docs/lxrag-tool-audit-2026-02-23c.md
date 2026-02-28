# lxRAG Tool Audit — lexRAG-visual (2026-02-23, run D)

**Workspace:** `/home/alex_rod/projects/code-visual`  
**Project ID:** `lexRAG-visual`  
**Rebuilt from:** empty Memgraph instance  
**Transaction:** `tx-05e51a2c`  
**Method:** lxRAG MCP tools only — no file reads, grep, or workspace list operations used for analysis  
**Prior audits:** [run A](lxrag-tool-audit-2026-02-22.md) · [run B](lxrag-tool-audit-2026-02-23.md) · [run C](lxrag-tool-audit-2026-02-23b.md)

---

## 1. Methodology

Tools exercised in order:

1. `init_project_setup` + `graph_rebuild(full, verbose)` — clean baseline
2. `graph_health(debug)` — full state introspection
3. `arch_validate(strict)` — absolute and relative path files
4. `impact_analyze` — absolute-path, relative-path, and mixed inputs
5. `contract_validate` — schema normalisation cross-checks
6. `context_pack` — agent task briefing
7. `test_run` — test execution
8. All remaining tools probed for enabled/disabled/schema-error status

---

## 2. Tool Availability Matrix

Tracking tool status across all four audit sessions.

| Tool                            | Run A    | Run B | Run C     | Run D        | Trend                    |
| ------------------------------- | -------- | ----- | --------- | ------------ | ------------------------ |
| `init_project_setup`            | ✅       | ✅    | ✅        | ✅           | stable                   |
| `graph_rebuild`                 | ✅       | ✅    | ✅        | ✅           | stable                   |
| `graph_health`                  | ✅       | ✅    | ✅        | ✅           | stable                   |
| `arch_validate`                 | ⚠️       | ⚠️    | ⚠️        | ⚠️           | stable (no layer config) |
| `impact_analyze`                | ⚠️ empty | ❌    | ⚠️ empty  | ✅ **FIXED** | improving                |
| `contract_validate`             | ✅       | ✅    | ✅        | ✅           | stable                   |
| `reflect`                       | ✅       | ✅    | ✅        | ✅           | stable (0 learnings)     |
| `feature_status`                | ⚠️       | ⚠️    | ⚠️        | ⚠️ improved  | improving hint           |
| `graph_query (cypher)`          | ✅       | ✅    | ✅        | ❌           | **regression**           |
| `arch_suggest`                  | ⚠️       | ⚠️    | ⚠️        | ❌           | **regression**           |
| `index_docs`                    | ✅       | ✅    | ✅        | ❌           | **regression**           |
| `ref_query`                     | ✅       | ✅    | ✅        | ❌           | **regression**           |
| `blocking_issues`               | ❌       | ❌    | ✅        | ❌           | **regression**           |
| `context_pack`                  | ❌       | ❌    | ✅        | ✅ empty     | stable-enabled           |
| `test_run`                      | ❌       | ❌    | ❌        | ✅ error     | **newly enabled**        |
| `find_pattern`                  | ❌       | ❌    | ⚠️        | ❌           | regression               |
| `semantic_search`               | ❌       | ❌    | ⚠️        | ❌           | regression               |
| `find_similar_code`             | ❌       | ❌    | ⚠️        | ❌           | regression               |
| `code_explain`                  | ❌       | ❌    | ⚠️        | ❌           | regression               |
| `semantic_slice`                | ❌       | ❌    | ⚠️        | ❌           | regression               |
| `semantic_diff`                 | ❌       | ❌    | ⚠️        | ❌           | regression               |
| `code_clusters`                 | ❌       | ❌    | ⚠️        | ❌           | regression               |
| `search_docs`                   | ❌       | ❌    | ❌+schema | ❌+schema    | stable broken            |
| `diff_since`                    | ❌       | ❌    | ❌        | ❌           | stable-off               |
| `episode_add`                   | ❌       | ❌    | ❌        | ❌+schema    | schema regression        |
| `episode_recall`                | ❌       | ❌    | ❌        | ❌           | stable-off               |
| `progress_query`                | ❌       | ❌    | ❌        | ❌           | stable-off               |
| `task_update`                   | ❌       | ❌    | ❌        | ❌           | stable-off               |
| `agent_claim/release/status`    | ❌       | ❌    | ❌        | ❌           | stable-off               |
| `coordination_overview`         | ❌       | ❌    | ❌        | ❌           | stable-off               |
| `decision_query`                | ❌       | ❌    | ❌        | ❌           | stable-off               |
| `suggest_tests`                 | ❌       | ❌    | ❌        | ❌           | stable-off               |
| `test_select / test_categorize` | ❌       | ❌    | ❌        | ❌           | stable-off               |

**Run D summary: 8 working, 4 with schema errors, 21 disabled/absent.**

---

## 3. Post-rebuild Graph State

### Health snapshot (debug profile)

| Metric                     | Run C | Run D    | Change       |
| -------------------------- | ----- | -------- | ------------ |
| `totalNodes`               | 875   | 900      | +25          |
| `totalRelationships`       | 1,438 | 1,487    | +49          |
| `indexedFiles`             | 28    | 28       | —            |
| `indexedFunctions`         | 90    | 90       | —            |
| `indexedClasses`           | 65    | 65       | —            |
| `cachedNodes`              | 0     | **234**  | **+234**     |
| `cachedRels`               | 0     | **824**  | **+824**     |
| `bm25IndexExists`          | false | **true** | **FIXED**    |
| `embeddings.ready`         | false | **true** | **improved** |
| `embeddings.generated`     | 0     | 0        | —            |
| `embeddings.driftDetected` | false | **true** | new field    |
| `driftDetected`            | true  | true     | persists     |
| `summarizer.configured`    | false | false    | —            |

**Key graph state improvements since run C:**

1. BM25 index now built — lexical search infrastructure is in place
2. In-memory cache partially populated for the first time (234 of 900 nodes, 824 of 1487 relationships)
3. `embeddings.ready: true` signals the pipeline is wired; `driftDetected: true` on embeddings is a new honest status flag

**Node growth** (+25) is accounted for by the new `docs/lxrag-tool-audit-2026-02-23b.md` document being indexed (adds DOCUMENT + SECTION + NEXT_SECTION + SECTION_OF + DOC_DESCRIBES nodes/relationships).

---

## 4. Findings

### F1 — `impact_analyze` is fixed for all path formats (resolved)

**Status: FIXED in run D.**

| Input format                                  | Run C result       | Run D result                                                                          |
| --------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------- |
| Absolute path (`/home/.../memgraphClient.ts`) | `directImpact: []` | `directImpact: ["src/App.tsx", "src/hooks/useGraphController.ts"]`                    |
| Relative path (`src/config/constants.ts`)     | not available      | `directImpact: 9 files`                                                               |
| Mixed (`/home/...layoutEngine.ts`)            | not available      | `directImpact: ["src/App.tsx", "src/lib/layoutWorker.ts", "src/state/graphStore.ts"]` |

The REFERENCES edge graph traversal is now powering impact analysis correctly. This was the largest functional regression from run A.

---

### F2 — `impact_analyze` includes changed file in its own `directImpact` list (new)

**Evidence:**

```
changedFiles: ["src/config/constants.ts", "src/lib/graphVisuals.ts"]
directImpact: [
  "src/App.tsx",
  "src/components/EdgeCanvas.tsx",
  ...
  "src/lib/graphVisuals.ts",   ← input file appears in its own impact
  ...
]
```

**Impact:** Consumers of `impact_analyze` who use `directImpact` to scope test runs or code reviews will re-process the file being changed — inflating blast radius metrics and causing potential circular logic in automated pipelines.

**Fix direction:** Filter `changedFiles` paths from `directImpact` output before returning; normalize paths (absolute vs relative) before the comparison.

---

### F3 — BM25 index now built; NL retrieval untestable this session (was F3 → partial fix)

**Status: Partial progress.**

`graph_health` shows `bm25IndexExists: true` for the first time across all audit sessions. The BM25 infrastructure is now being built during `graph_rebuild`. However, `graph_query` (cypher and natural) is disabled this session, so NL retrieval cannot be directly tested.

**Still blocked:**

- Embeddings not generated (0 of 900 nodes) so semantic tools remain unavailable
- `retrieval.mode` remains `lexical_fallback`
- BM25 index being present does not yet confirm that natural language queries return results

---

### F4 — `arch_validate` silently drops relative-path files (new)

**Evidence:**

- Input: 3 files — `src/lib/graphVisuals.ts` (relative), `src/components/EdgeCanvas.tsx` (relative), `src/config/constants.ts` (relative... wait, actually two relative and one was absolute in earlier call)
- Second call: 3 files — `src/lib/graphVisuals.ts`, `src/components/EdgeCanvas.tsx`, `src/config/constants.ts` (all relative)
- Output: 2 violations, `filesChecked: 3` — but `src/lib/graphVisuals.ts` has no violation entry

When called with 3 relative-path files, `arch_validate` processes only 2 (EdgeCanvas.tsx and constants.ts) and silently skips `graphVisuals.ts`. The file count in `statistics.filesChecked` reports 3 (correct) but only 2 appear in `violations` — there is no "skipped" or "unknown" entry.

**Impact:** False clean signal for `graphVisuals.ts` — no violation is generated, so callers assume it is either correct or unassignable. The `filesChecked` count is accurate but the per-file results are not.

**Fix direction:** Every file in the input set must produce exactly one entry in the output — either a violation or a clean pass. Never silently omit.

---

### F5 — `test_run` executes with Node.js v10.19.0 (new)

**Evidence:**

```
tool: test_run
input: ["/home/alex_rod/projects/code-visual/src"]
output:
  status: "failed"
  error: "Command failed: npx vitest run --reporter=verbose ..."
  "ERROR: npm is known not to run on Node.js v10.19.0
   You'll need to upgrade to a newer Node.js version..."
  testsRun: 1
```

**Impact:**

- `test_run` is newly enabled in this session but immediately non-functional
- The tool forks a child process with the system's Node.js v10.19.0 environment rather than the project's runtime environment (which must be ≥18 to run Vite/Vitest)
- Any automation relying on `test_run` results will always see failing tests regardless of actual test state
- `testsRun: 1` when 0 actual test files exist is a counting error — `vitest run` with no test files should report 0

**Fix direction:**

- Resolve the Node.js binary path from the shell environment at invocation time (e.g., via `which node`) rather than using a hardcoded system path
- Report `testsRun: 0` when no test files match — do not count the vitest invocation itself

---

### F6 — `episode_add` `type` schema validation fires before disabled check (new)

**Evidence:**

- Call with `type="observation"` → `ERROR: must be equal to one of the allowed values`
- Call with `type="decision"` → same enum error
- Call with `type="learning"` → `Tool currently disabled by the user`

The schema validation for the `type` enum fires before the disabled-check middleware, so the error message depends on which specific value is used rather than consistently reporting "tool disabled."

**Secondary finding:** The error message "must be equal to one of the allowed values" does not list those values. A developer calling this tool cannot determine valid values from the error alone.

`contract_validate` says `type="observation"` is valid for `episode_add`. The actual tool rejects it. This is a **contract_validate vs actual schema mismatch** — the normalisation layer has stale type enums.

**Fix direction:**

- Apply disabled-check before schema validation so the error is always "tool is disabled" when disabled
- Include `allowedValues` in enum validation error messages
- Sync `contract_validate`'s internal schema registry with the actual MCP tool schemas

---

### F7 — `search_docs` rejects `profile` parameter; `contract_validate` says it is valid (persists)

**Evidence:**

- `search_docs(query="architecture", limit=5, profile="balanced")` → `ERROR: must NOT have additional properties`
- `contract_validate(tool="search_docs", arguments={query, profile, limit})` → `valid: true, warnings: []`

The normalisation layer and the actual tool schema diverge. Same pattern as F6.

---

### F8 — `context_pack` enabled but always returns empty (new)

**Evidence:**

- Called twice with different tasks: `"audit lxRAG tools"` and `"memgraphClient connect query execute bolt driver"`
- Both return: `entryPoint: "No entry point found"`, `coreSymbols: []`, `dependencies: []`, `decisions: []`, `learnings: []`, `episodes: []`

**Root cause:** `context_pack` resolves entry points and symbols through the vector/embedding index. Since `embeddings.generated = 0`, there are no vectors to search — the tool returns an empty briefing every time.

**Secondary issue:** The `plan.note` field returns `"Plan-node integration deferred to later phase."` even when the task has never been started. This is a static placeholder, not a live status.

**Impact:** Any agent using `context_pack` as a session-start tool to get oriented on a task will receive no information and may proceed with incorrect assumptions.

---

### F9 — Tool availability is non-deterministic across sessions (persists + worsening)

**Evidence across all 4 runs:**

| Tool              | Runs available         | Runs absent |
| ----------------- | ---------------------- | ----------- | --------- |
| `graph_query`     | A, B, C                | D           |
| `index_docs`      | A, B, C                | D           |
| `arch_suggest`    | A, B, C                | D           |
| `ref_query`       | A, B, C                | D           |
| `blocking_issues` | C                      | A, B, D     |
| `impact_analyze`  | A (broken), C (broken) | B           | D (fixed) |
| Semantic tools    | C (broken)             | A, B, D     |
| `context_pack`    | C, D (empty)           | A, B        |
| `test_run`        | D (error)              | A, B, C     |

Run D removed 4 tools that worked across A/B/C (`graph_query`, `index_docs`, `arch_suggest`, `ref_query`) and added `test_run` (broken). No session has had a stable, additive tool surface.

**Impact:**

- Automated audit workflows cannot be scripted — the tool surface changes after every session boundary
- Findings cannot be incrementally validated because tools used in one session may not be available in the next
- An agent that plans a multi-session task cannot know which tools will be available on resumption

---

### F10 — Cache sync still incomplete (partially improved)

**Status: Partial improvement.**

- Run C: `cachedNodes: 0` vs `memgraphNodes: 875` — 0% cache coverage
- Run D: `cachedNodes: 234` vs `memgraphNodes: 900` — 26% cache coverage
- `driftDetected: true` still fires immediately after a fresh rebuild

The cache is now being partially populated (progress from 0 to 234 nodes). However 66% of nodes and 45% of relationships remain out of sync. The drift flag remains permanently active.

---

### F11 — Persisting issues (unremediated across all runs)

| Issue                                                 | Runs present | Status     |
| ----------------------------------------------------- | ------------ | ---------- |
| 6 files with relative `FILE.path`                     | A, B, C, D   | Unresolved |
| `SECTION.relativePath = null` (265/265)               | B, C         | Unresolved |
| Embeddings never generated (`generated: 0`)           | A, B, C, D   | Unresolved |
| `arch_suggest` always returns `src/types/`            | A, B, C      | Disabled D |
| `arch_validate` reports all files as `layer: unknown` | A, B, C, D   | Unresolved |
| No `.lxrag/config.json` exists                        | A, B, C, D   | Unresolved |
| Feature registry always empty                         | A, B, C, D   | Unresolved |
| `reflect` always returns 0 learnings                  | A, B, C, D   | Unresolved |
| `context_pack` / `code_explain` rely on embeddings    | A, B, C, D   | Unresolved |

---

## 5. Fixes Confirmed in Run D

| Fix                              | Evidence                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `impact_analyze` traversal       | Returns real `directImpact` for 3 tested inputs including relative-path files |
| BM25 index build                 | `bm25IndexExists: true` for first time                                        |
| Cache partial population         | `cachedNodes: 234` vs `0` in runs A–C                                         |
| `embeddings.ready: true`         | Infrastructure wired; write path still broken                                 |
| `embeddings.driftDetected` field | New honest status flag with clear recommendation message                      |
| `feature_status` hint            | Now returns `availableFeatureIds: []` and a `hint` field                      |

---

## 6. Prioritized Fix Plan (updated)

| Priority | Finding                                                  | Fix                                                                                                      |
| -------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| P0       | Embeddings not generated                                 | Wire embedding write path; `index_docs(withEmbeddings=true)` must write vectors to Qdrant                |
| P0       | Tool availability rotates (F9)                           | Expose stable tool manifest via `graph_health` or `tools_list`; lock tools to a consistent set per-build |
| P1       | NL retrieval untested (F3)                               | With BM25 now present, verify `graph_query(natural)` returns results                                     |
| P1       | Path normalization split (F11)                           | Normalize all `FILE.path` to absolute at parse time                                                      |
| P1       | SECTION.relativePath null (F11)                          | Propagate `document.relativePath` to each SECTION in DocsBuilder                                         |
| P1       | Cache sync incomplete (F10)                              | Sync full cache post-rebuild, not partial                                                                |
| P1       | `arch_validate` silent drop for relative-path files (F4) | Ensure every input file has exactly one output entry                                                     |
| P2       | `impact_analyze` self-reference (F2)                     | Filter `changedFiles` paths from `directImpact` output                                                   |
| P2       | `test_run` Node.js version (F5)                          | Resolve Node.js binary from shell env at runtime                                                         |
| P2       | `episode_add` schema vs disabled order (F6)              | Apply disabled-check before schema validation; expose `allowedValues` in enum errors                     |
| P2       | `contract_validate` schema drift (F6/F7)                 | Sync normalisation registry with actual MCP tool schemas                                                 |
| P2       | `context_pack` empty without embeddings (F8)             | Fall back to Cypher-based entry-point resolution when vectors unavailable                                |
| P3       | No `.lxrag/config.json`                                  | Generate minimal layer config during `init_project_setup` from directory structure                       |
| P3       | Feature registry empty                                   | Document how to populate via `feature_status` or config file                                             |

---

## 7. Re-run Checklist

After fixes, run these assertions in order:

**Embeddings & retrieval:**

- [ ] `index_docs(withEmbeddings=true)` → `graph_health` shows `embeddings.generated > 0`
- [ ] `graph_query(language='natural', 'React component rendering')` → ≥1 result
- [ ] `semantic_search(query='graph state management')` → ≥1 result
- [ ] `context_pack(task='graph rendering')` → `entryPoint` is a real file, `coreSymbols ≠ []`

**Path normalization:**

- [ ] `MATCH (f:FILE) WHERE NOT f.path STARTS WITH '/' RETURN count(f)` → 0
- [ ] `MATCH (s:SECTION) WHERE s.relativePath IS NULL RETURN count(s)` → 0

**Cache & health:**

- [ ] `graph_health` after full rebuild → `cachedNodes = memgraphNodes`, `driftDetected: false`

**impact_analyze:**

- [ ] `impact_analyze(files=['src/lib/graphVisuals.ts'])` → `directImpact` does NOT contain `src/lib/graphVisuals.ts`

**arch_validate:**

- [ ] 3 relative-path files input → 3 entries in output (no silent drops)

**test_run:**

- [ ] `test_run` executes with the project's Node.js version (≥18)

**Tool stability:**

- [ ] Same set of tools available across two consecutive sessions started one hour apart

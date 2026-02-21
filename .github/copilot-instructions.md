# Copilot Instructions — Efficient Agent Workflow

These instructions define how to communicate and collaborate efficiently with the coding agent in this repository.

## Communication Style

- Be explicit, short, and outcome-focused.
- For each request, state: **goal**, **constraints**, and **definition of done**.
- Prefer concrete acceptance criteria over open-ended phrasing.
- When asking for changes, include target files/scope when known.

## Request Template

Use this structure whenever possible:

1. Goal: what should be achieved
2. Scope: which files/modules are in/out
3. Constraints: UX, performance, API, style, compatibility
4. Validation: what to run/check
5. Done when: clear pass/fail conditions

## Execution Workflow

- Start with quick context gathering, then implement immediately.
- Prefer minimal, targeted edits over broad refactors.
- Keep behavior stable unless a change is explicitly requested.
- After edits, run the most relevant validation (build/tests/lint) for changed areas.
- Report results with a concise summary and next best action.

## Progress & Status

- For multi-step work, provide short progress updates during execution.
- If blocked, report the blocker, attempted fix, and one concrete alternative.
- If assumptions are needed, state them briefly and continue with the safest option.

## Quality Bar

- Fix root causes, not only symptoms.
- Preserve existing conventions and architecture.
- Avoid unrelated edits.
- Keep performance in mind for interactive graph flows (incremental updates, avoid unnecessary rerenders).

## Project Context (Code-Visual)

This project is a visual app to navigate Memgraph through direct queries.

- Start from a high-level diagram and allow interactive expansion per node.
- Keep interactions responsive and clear (loading, empty, error states).
- Prioritize efficient graph rendering and smooth, lightweight transitions.

## Response Format

Every substantive agent response should include:

1. Active context used (workspace/scope)
2. Current status (done/in progress/blocked)
3. Single best next action

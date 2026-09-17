# Antigravity Optimization Playbook

## Goal

Use Antigravity as an engineering multiplier, not an uncontrolled code
generator.

Recommended loop: `Plan → Implement → Verify → Review → Commit`

Antigravity provides agentic development surfaces,
browser/terminal/editor workflows and artifacts for plans, diffs and
verification. Use these deliberately.

## Golden rule

Do not ask: "Build all of TatkalCore." Give one bounded milestone.

Example: "Inspect the existing booking schema and service. Plan and
implement PostgreSQL seat locking. Add concurrency tests. Run
typecheck/tests and report changed files and verification."

## Project context

Keep:

``` text
docs/
├── architecture.md
├── database.md
├── api-contract.md
├── research-plan.md
└── agent-rules.md
```

`agent-rules.md` should state: 1. PostgreSQL is authoritative for seat
ownership. 2. Redis is not authoritative. 3. Never trust frontend
availability for correctness. 4. Booking mutations must be
transaction-safe. 5. Booking creation must support idempotency. 6. Avoid
unnecessary dependencies. 7. Concurrency changes require tests. 8. Never
invent research results. 9. Do not claim real IRCTC integration. 10.
Inspect before editing. 11. Keep changes scoped. 12. Run relevant
verification.

## Prompt structure

``` text
CONTEXT
GOAL
CONSTRAINTS
FILES TO INSPECT
TASK
EDGE CASES
TEST REQUIREMENTS
VERIFICATION
OUTPUT FORMAT
```

## Plan before implementation

For each feature ask the agent for: - implementation plan - affected
files - schema/API impact - dependency impact - test plan - edge cases

Then review the plan before editing.

## Small tasks

Prefer: - migration - repository method - reservation transaction - API
route - tests - metrics as separate tasks.

## Parallel agents

Use parallel agents only for independent work. Do not have multiple
agents edit the same critical booking/schema files simultaneously.

## Browser verification

Use browser-capable workflows to verify responsive UI, navigation,
loading/error states, booking flow and dashboards.

## Frontend prompt template

Ask the agent to inspect existing components/design tokens first;
implement mobile/tablet/desktop; add skeleton/error/empty states; reuse
components; avoid new UI libraries; then typecheck, lint, test and
verify responsive behavior.

## Backend prompt template

Ask the agent to inspect module/schema/transaction/error handling first;
validate input; preserve transaction boundaries and authorization; add
tests; handle dependency failures; avoid unrelated edits.

## Concurrency prompt template

First trace the booking flow and identify shared state/race windows.
Only then implement the smallest safe transaction/locking change and
prove it with concurrent tests.

## Research prompt template

Ask the agent to audit experiment design, controls, metrics, repeated
runs and reproducibility. It must not invent results.

## Debugging

Use: 1. exact error 2. inspection 3. root-cause hypothesis 4. smallest
fix 5. regression test 6. verification 7. diff review

Avoid "fix everything."

## Context/cost optimization

Keep documentation modular, avoid giant repeated prompts, provide only
relevant files, use reusable project rules/skills, and ask for concise
milestone summaries.

## Reusable skills

Create narrow workflows for: - API implementation - migrations - React
pages - concurrency tests - k6 tests - documentation - security review

## Verification contract

Every agent task should end with:

``` text
Changed files:
Tests run:
Test result:
Typecheck:
Lint:
Known risks:
Next task:
```

## Git safety

Before a large agent task:

``` bash
git status
git add .
git commit -m "checkpoint: before agent task"
```

After:

``` bash
git diff
git status
npm test
```

Never blindly accept a large generated diff.

## Human-only decisions

Human review is mandatory for: - research conclusions - fairness
definition - security policy - source-of-truth architecture - production
secrets - irreversible migrations - deployment credentials - final
performance claims

## Ideal workflow

``` text
Requirement
↓
Agent reads project docs
↓
Plan
↓
Human review
↓
Implementation
↓
Tests
↓
Browser/terminal verification
↓
Diff review
↓
Commit
↓
Next milestone
```

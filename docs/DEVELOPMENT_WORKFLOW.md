# Development & delivery workflow (Aquatech)

This document is the canonical process for ticket-sized work across Aquatech repos. Cursor agents and humans follow the same stages.

## 1. Branch per repo

- Create a **new branch from `main`** in **every repo** touched by the change.
- Naming: **`feat/<ticket-or-topic>-<short-slug>`** or **`fix/...`** as appropriate.
- The branch name (or slug) must make it obvious **what we are building** (e.g. `feat/agt-123-product-merge-dashboard`).

## 2. Local iteration

- Implement and run the app/API **locally** until behavior matches the acceptance notes from the ticket or chat.
- Fix linter issues on edited files before push.

## 3. Tests (when they add signal)

- Add or extend **unit/integration tests** when they protect real behavior or regressions—not for every typo fix.
- If the change is risky (auth, merges, migrations, payouts), bias toward adding tests.

## 4. Push and pull request

- Push the branch (+ upstream if needed).
- Open a **pull request into `main`** using `gh` (or GitHub UI).
- **PR body**: summarize intent, scope, risks, and test plan abstracted from the Cursor chat / ticket (bullet lists are fine).

## 5. Review, merge, close

- Wait for maintainer approval; **merge after approval**.
- Agent session closes once the merged state is verified and notes are persisted (see Session log).

## Session log (`session/` — not committed)

Delivery context is persisted **outside Git**:

- Path: **`session/YYYY-MM-DD/session.json`** at the root of **each repo** affected that day (for cross-repo tickets, duplicate the file or paste the same object into both).
- **`session/` is listed in `.gitignore`** — never commit dated session folders.

### Suggested `session.json` shape

```json
{
  "date": "YYYY-MM-DD",
  "title": "Short feature name",
  "ticket": "optional id or URL",
  "repos": [{ "name": "Aquatech_api", "branch": "feat/..." }],
  "summary": "1–3 sentences for future you",
  "prUrls": [],
  "status": "in_progress | pr_open | merged",
  "chatAbstract": "Bullets distilled from the Cursor conversation (decisions, constraints, out of scope)"
}
```

Update `status` and `prUrls` as the work moves through review.

## Related

- Product merge / Tuya duplicate handling: `MERGE_DUPLICATE_TUYA_PRODUCTS.md`

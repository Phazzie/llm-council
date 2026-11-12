# Origin CI

GitHub Actions is not available on this account (billing lock). CI runs in Cursor Origin through the Depot app, which reads GitHub-Actions-syntax workflows from `.depot/workflows/` and executes them on `depot-ubuntu-24.04` after the repository is detached from GitHub.

There is no `.github/workflows` directory today. Nothing in that tree was removed. Depot does not read it. Workflows added there later will not run once the repo is detached.

Reference pattern: [Phazzie/streetroyalty `.depot/workflows/ci.yml`](https://github.com/Phazzie/streetroyalty/blob/main/.depot/workflows/ci.yml) and [`scripts/ai-review.mjs`](https://github.com/Phazzie/streetroyalty/blob/main/scripts/ai-review.mjs).

## Workflow map

| GitHub Actions workflow | Depot equivalent | When it runs |
| --- | --- | --- |
| None. This repo has never had a file under `.github/workflows`. | [`.depot/workflows/ci.yml`](../.depot/workflows/ci.yml) | Pull requests, and pushes to `master` |

### `backend`

Locked install, then the smoke tests:

```bash
uv sync --frozen
uv run pytest
```

`uv` is pinned to 0.13.7 via `astral-sh/setup-uv@v10.3.3`. Python is 3.10, matching `.python-version`. `uv sync --frozen` installs the `dev` group, which contains pytest. Do not pass `--no-dev`.

`tests/test_smoke.py` imports the FastAPI app and calls `GET /` and `GET /api/conversations` with `TestClient`. It does not call OpenRouter.

### `frontend`

Locked install, then the existing scripts, plus the review-script unit tests (they use only Node built-ins):

```bash
npm ci
npm run lint
npm run build
node --test scripts/ai-review.test.mjs
```

`npm ci` and the npm scripts run in `frontend/` against `frontend/package-lock.json`. Node is 22. The `node --test` step runs from the repository root.

### `ai-review`

Pull requests only. The job checks out full history and runs:

```bash
node scripts/ai-review.mjs
```

The script sends the diff against `origin/$GITHUB_BASE_REF` (default `master`) to Grok (`grok-4.5` on `https://api.x.ai/v1/chat/completions`). It then posts with:

```bash
origin pr comment "$PR_NUMBER" --body-file "$BODY" --edit-last --create-if-none
```

`--edit-last` updates the newest Origin discussion comment from this author. `--create-if-none` writes one when there is no previous comment.

When `XAI_API_KEY` is unset or blank, the script prints `AI review skipped: XAI_API_KEY is not set` and exits 0. When the key is set but the `origin` CLI is not on `PATH`, it prints the review to the log and exits 0. A failed `origin pr comment` is also logged without failing the job. An xAI HTTP error still exits 1, because the secret was present and the review itself failed.

The streetroyalty script can also post through the GitHub Issues API when `GITHUB_TOKEN` and `GITHUB_REPOSITORY` are set. This copy does not. Comments go to Origin even if those GitHub variables are present.

## GitHub-only pieces

These are not part of Depot CI and are not carried over:

- GitHub Actions runners and the Actions billing path. No workflow files exist under `.github/workflows` to delete.
- Pull-request comments via `api.github.com` issue comments. Origin's `origin pr comment` is the publisher.
- `GITHUB_TOKEN` as a credential for publishing the review.
- Any future workflow that lives only in `.github/workflows`. After detach, Depot will not run it. Add the equivalent under `.depot/workflows/`.

`actions/checkout`, `actions/setup-node`, and `astral-sh/setup-uv` stay in the Depot workflow. They are GitHub-Actions-syntax steps that Depot executes on `depot-ubuntu-24.04`. npm and uv caches use the same syntax as the reference workflow.

## Secrets to enter in Depot

| Secret | Used by | Required for a green job? |
| --- | --- | --- |
| `XAI_API_KEY` | `ai-review` (Grok) | No. Missing key skips and exits 0. Set it for a review comment to be posted. |
| `OPENROUTER_API_KEY` | The running app (`backend/config.py`), not this workflow | No. CI never calls OpenRouter. Enter it in Depot only if a later job or preview boots the council. |

No other secrets are referenced by `.depot/workflows/ci.yml`.

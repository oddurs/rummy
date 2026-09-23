#!/usr/bin/env bash
# Ship the current branch: check, push, open a PR (or reuse the open one) and
# queue it to merge by itself once CI is green.
#
#   pnpm pr                 check, push, PR, auto-merge
#   pnpm pr --no-check      skip the local check (CI still runs it)
#   pnpm pr --no-merge      open the PR but leave merging to a person
set -euo pipefail

check=1 merge=1
for arg in "$@"; do
  case "$arg" in
    --no-check) check=0 ;;
    --no-merge) merge=0 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" = main ]; then
  echo "On main. Start a branch first: pnpm item <id>, or git switch -c <slug> origin/main" >&2
  exit 1
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Uncommitted changes. Commit them first." >&2
  exit 1
fi

if [ "$check" = 1 ]; then
  pnpm check
  if command -v cairn >/dev/null; then cairn check -q && cairn render --check; fi
fi

git push -q -u origin "$branch"
if ! gh pr view --json number >/dev/null 2>&1; then
  gh pr create --fill --base main >/dev/null
fi
if [ "$merge" = 1 ]; then
  gh pr merge --auto --merge --delete-branch >/dev/null
  echo "Queued to merge when CI passes."
fi
gh pr view --json url --jq .url

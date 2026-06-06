#!/usr/bin/env bash
# Hermetic per-agent environments (principle 7).
# Give each concurrent agent its own git worktree so developers/reviewers/judges never trip over
# each other's working trees or lockfiles. Prune stale metadata before every add.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_BASE="${AGENTRIG_WORKTREE_BASE:-$HOME/.agentrig/worktrees/$(basename "$REPO_ROOT")}"
AGENT_ID="${1:-agent}"
BRANCH="${2:-agentrig/$AGENT_ID}"

mkdir -p "$WORKTREE_BASE"

# Principle 7: prune stale worktree metadata BEFORE every add to avoid the classic
# "git worktree add refuses after stale metadata" crash.
git -C "$REPO_ROOT" worktree prune --expire now

WORKTREE_DIR="$WORKTREE_BASE/$AGENT_ID"
if git -C "$REPO_ROOT" worktree list --porcelain | grep -q "worktree $WORKTREE_DIR$"; then
  echo "Reusing worktree: $WORKTREE_DIR"
else
  git -C "$REPO_ROOT" worktree add -B "$BRANCH" "$WORKTREE_DIR" >/dev/null
  echo "Created worktree: $WORKTREE_DIR (branch $BRANCH)"
fi

echo "$WORKTREE_DIR"

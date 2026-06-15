#!/usr/bin/env bash
# Hermetic per-agent worktrees (principle 7) + safe crash recovery.
#
# Usage:
#   repair-worktrees.sh add <agent-id> [branch]   Create/reuse an isolated worktree, print its path
#   repair-worktrees.sh repair [--apply]          Prune stale metadata + safely recover worktrees
#                                                 (dry-run unless --apply)
#   repair-worktrees.sh                            Same as `repair` (dry-run)
#
# Safety rules for `repair` (so we never corrupt a live agent session):
#   - Stale .git/index.lock / HEAD.lock are removed ONLY if older than LOCK_MIN_AGE_SECONDS AND not
#     currently open (checked via lsof when available).
#   - A worktree with open files (lsof) is treated as ACTIVE and skipped entirely.
#   - Before any `git reset --hard` / `git clean -fd`, dirty files are ARCHIVED to
#     ~/.agentrig/worktree-archives/<timestamp>/<agent>/ so interrupted work is recoverable.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_BASE="${AGENTRIG_WORKTREE_BASE:-$HOME/.agentrig/worktrees/$(basename "$REPO_ROOT")}"
ARCHIVE_BASE="${AGENTRIG_WORKTREE_ARCHIVE:-$HOME/.agentrig/worktree-archives}"
LOCK_MIN_AGE_SECONDS="${AGENTRIG_LOCK_MIN_AGE_SECONDS:-120}"
LOCK_NAMES=("index.lock" "HEAD.lock")

mkdir -p "$WORKTREE_BASE"

path_has_open_files() {
  # Returns 0 (true) if lsof reports any open handle under the path. If lsof is absent, assume not.
  local target="$1"
  command -v lsof >/dev/null 2>&1 || return 1
  if [ -d "$target" ]; then
    lsof +D "$target" >/dev/null 2>&1
  else
    lsof "$target" >/dev/null 2>&1
  fi
}

file_age_seconds() {
  local f="$1" now mtime
  now="$(date +%s)"
  # GNU stat (-c) then BSD/macOS stat (-f).
  mtime="$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f" 2>/dev/null || echo "$now")"
  echo "$(( now - mtime ))"
}

cmd_add() {
  local agent_id="${1:?usage: repair-worktrees.sh add <agent-id> [branch]}"
  local branch="${2:-agentrig/$agent_id}"
  # Prune stale metadata BEFORE every add (the classic "worktree add refuses" crash).
  git -C "$REPO_ROOT" worktree prune --expire now
  local dir="$WORKTREE_BASE/$agent_id"
  if git -C "$REPO_ROOT" worktree list --porcelain | grep -q "^worktree $dir$"; then
    echo "Reusing worktree: $dir" >&2
  else
    git -C "$REPO_ROOT" worktree add -B "$branch" "$dir" >/dev/null
    echo "Created worktree: $dir (branch $branch)" >&2
  fi
  echo "$dir"
}

cmd_repair() {
  local apply="${1:-}"
  local do_apply=0
  [ "$apply" = "--apply" ] && do_apply=1

  echo "Pruning stale worktree metadata…" >&2
  [ "$do_apply" -eq 1 ] && git -C "$REPO_ROOT" worktree prune --expire now || git -C "$REPO_ROOT" worktree prune --expire now --dry-run || true

  [ -d "$WORKTREE_BASE" ] || { echo "No worktrees under $WORKTREE_BASE"; return 0; }

  local ts; ts="$(date +%Y%m%d-%H%M%S)"
  for dir in "$WORKTREE_BASE"/*/; do
    [ -d "$dir" ] || continue
    dir="${dir%/}"
    local agent; agent="$(basename "$dir")"

    if path_has_open_files "$dir"; then
      echo "[skip-active] $agent (open files present)"
      continue
    fi

    # Remove stale, unopened lock files only.
    local gitdir="$dir/.git"
    [ -f "$dir/.git" ] && gitdir="$(sed -n 's/^gitdir: //p' "$dir/.git")"
    for lock in "${LOCK_NAMES[@]}"; do
      local lock_path="$gitdir/$lock"
      [ -f "$lock_path" ] || continue
      if path_has_open_files "$lock_path"; then
        echo "[skip-active-lock] $agent/$lock"
      elif [ "$(file_age_seconds "$lock_path")" -ge "$LOCK_MIN_AGE_SECONDS" ]; then
        echo "[remove-lock] $agent/$lock"
        [ "$do_apply" -eq 1 ] && rm -f "$lock_path"
      else
        echo "[skip-young-lock] $agent/$lock"
      fi
    done

    # Archive dirty files before any reset/clean.
    if [ -n "$(git -C "$dir" status --porcelain 2>/dev/null)" ]; then
      local archive="$ARCHIVE_BASE/$ts/$agent"
      echo "[archive+reset] $agent (dirty) -> $archive"
      if [ "$do_apply" -eq 1 ]; then
        mkdir -p "$archive"
        git -C "$dir" status --porcelain -z | while IFS= read -r -d '' entry; do
          local f="${entry:3}"
          [ -f "$dir/$f" ] || continue
          mkdir -p "$archive/$(dirname "$f")"
          cp -p "$dir/$f" "$archive/$f" 2>/dev/null || true
        done
        git -C "$dir" reset --hard >/dev/null 2>&1 || true
        git -C "$dir" clean -fd >/dev/null 2>&1 || true
      fi
    else
      echo "[clean] $agent"
    fi
  done
  [ "$do_apply" -eq 1 ] || echo "(dry-run — re-run with --apply to make changes)"
}

case "${1:-repair}" in
  add) shift; cmd_add "$@" ;;
  repair) shift; cmd_repair "${1:-}" ;;
  *) cmd_repair "${1:-}" ;;
esac

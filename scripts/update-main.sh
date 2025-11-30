#!/usr/bin/env bash
set -euo pipefail

BRANCH="main"

# Ensure we start from the branch the developer was on
START_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Create main branch if it does not exist
if ! git show-ref --verify --quiet refs/heads/$BRANCH; then
  echo "Creating '$BRANCH' branch from current HEAD ($START_BRANCH)."
  git branch $BRANCH
fi

echo "Checking out '$BRANCH'…"
git checkout $BRANCH

# If a remote named origin exists, try to fast-forward from it
if git remote get-url origin >/dev/null 2>&1; then
  echo "Fetching latest '$BRANCH' from origin."
  git fetch origin $BRANCH || true
  if git show-ref --verify --quiet refs/remotes/origin/$BRANCH; then
    echo "Attempting fast-forward merge from origin/$BRANCH."
    git merge --ff-only origin/$BRANCH || git merge origin/$BRANCH
  else
    echo "Remote branch origin/$BRANCH not found; skipping merge."
  fi
else
  echo "No 'origin' remote configured; skipping fetch."
fi

echo "Returning to original branch '$START_BRANCH'."
git checkout $START_BRANCH

echo "Local '$BRANCH' is up to date."

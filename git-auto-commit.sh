#!/bin/bash

# ============================================
# Git Auto Commit & Push Script
# ============================================

set -e

echo "===================================="
echo "Checking Git Status..."
echo "===================================="

git status

echo ""
echo "Waiting for 2 seconds..."
sleep 2

echo ""
read -p "Confirm to proceed? (yes/no): " confirm

if [[ "$confirm" != "yes" ]]; then
    echo "Operation cancelled."
    exit 0
fi

echo ""
echo "Generating Commit ID..."

# Get last commit message
LAST_MSG=$(git log -1 --pretty=%B 2>/dev/null)

if [[ $LAST_MSG =~ Commit-ID[[:space:]]*:[[:space:]]*([0-9]+) ]]; then
    LAST_ID=${BASH_REMATCH[1]}
    NEW_ID=$((LAST_ID + 1))
else
    NEW_ID=1
fi

COMMIT_ID=$(printf "%06d" $NEW_ID)

echo "Commit ID : $COMMIT_ID"

echo ""
echo "Adding files..."
git add .

echo ""
echo "Creating commit..."
git commit -m "Commit-ID : $COMMIT_ID"

echo ""
echo "Pushing to GitHub..."
git push -u origin main

echo ""
echo "===================================="
echo "Done!"
echo "Commit-ID : $COMMIT_ID"
echo "===================================="

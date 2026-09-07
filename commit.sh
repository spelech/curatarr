#!/usr/bin/env bash
set -e

# Change to the script's directory (repo root)
cd "$(dirname "$0")"

if [ -z "$1" ]; then
    echo "Usage: ./commit.sh \"<commit_message>\""
    exit 1
fi

echo "🔍 Validating backend Release build & tests..."
dotnet test curatarr.slnx --configuration Release --collect:"XPlat Code Coverage" --verbosity minimal

echo "🔍 Running frontend lint & build..."
if [ -d src/Curatarr.Web ]; then
    (cd src/Curatarr.Web && npm run lint && npm run build)
fi

echo "🔍 Validating release integrity..."
if [ -f scripts/verify_release.py ]; then
    python3 scripts/verify_release.py
fi

echo "💾 Creating atomic commit: '$1'..."
git add -A
git commit -m "$1"
echo "✅ Commit created successfully."

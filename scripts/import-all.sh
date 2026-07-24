#!/bin/sh
# Usage: ./import-all.sh <projectCode> <directory>
# Example: ./import-all.sh my-project /app/translations/
# Directory should contain files named like: zh-Hans.json, en-US.json, ja-JP.json

PROJECT=$1
DIR=$2

if [ -z "$PROJECT" ] || [ -z "$DIR" ]; then
  echo "Usage: $0 <projectCode> <directory>"
  echo "Example: $0 my-project /app/translations"
  exit 1
fi

echo "Importing all JSON files from $DIR to project $PROJECT"
echo "--------------------"

for f in "$DIR"/*.json; do
  filename=$(basename "$f")
  lang="${filename%.json}"
  echo "[$lang] Importing $filename..."
  pnpm tsx src/scripts/import-json.ts "$PROJECT" "$f" "$lang"
  echo "[$lang] Done."
done

echo "--------------------"
echo "All imports complete."

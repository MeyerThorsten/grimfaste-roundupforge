#!/usr/bin/env bash
#
# sheets-sync.sh — Google Sheets operations using Google Workspace CLI (gwc)
#
# Prerequisites:
#   1. Install: go install github.com/googleworkspace/cli/cmd/gwc@latest
#   2. Auth:    gwc auth login --scopes https://www.googleapis.com/auth/spreadsheets
#
# Usage:
#   ./scripts/sheets-sync.sh read-keywords <spreadsheet_id> [tab_name]
#   ./scripts/sheets-sync.sh write-results <spreadsheet_id> <csv_file> [tab_name]
#   ./scripts/sheets-sync.sh list-tabs <spreadsheet_id>
#
set -euo pipefail

COMMAND="${1:-help}"
SPREADSHEET_ID="${2:-}"
THIRD_ARG="${3:-}"

case "$COMMAND" in
  read-keywords)
    TAB="${THIRD_ARG:-Keywords}"
    echo "Reading keywords from ${TAB}!A:A ..."
    gwc sheets spreadsheets values get \
      --spreadsheet-id "$SPREADSHEET_ID" \
      --range "${TAB}!A:A" \
      --major-dimension COLUMNS \
      2>/dev/null | jq -r '.values[0][]' 2>/dev/null || \
    gwc sheets spreadsheets values get \
      "$SPREADSHEET_ID" \
      "${TAB}!A:A" | jq -r '.values[][]'
    ;;

  write-results)
    CSV_FILE="$THIRD_ARG"
    TAB="${4:-Results}"
    if [ -z "$CSV_FILE" ] || [ ! -f "$CSV_FILE" ]; then
      echo "Error: CSV file not found: $CSV_FILE"
      exit 1
    fi
    echo "Writing results to tab '${TAB}' ..."
    # Convert CSV to JSON array-of-arrays for the Sheets API
    python3 -c "
import csv, json, sys
with open('$CSV_FILE') as f:
    rows = list(csv.reader(f))
print(json.dumps({'values': rows}))
" > /tmp/sheets_payload.json

    gwc sheets spreadsheets values update \
      --spreadsheet-id "$SPREADSHEET_ID" \
      --range "${TAB}!A1" \
      --value-input-option RAW \
      --body "$(cat /tmp/sheets_payload.json)"

    rm -f /tmp/sheets_payload.json
    echo "Done. Wrote $(wc -l < "$CSV_FILE") rows to ${TAB}."
    ;;

  list-tabs)
    echo "Tabs in spreadsheet:"
    gwc sheets spreadsheets get \
      --spreadsheet-id "$SPREADSHEET_ID" \
      2>/dev/null | jq -r '.sheets[].properties.title' 2>/dev/null || \
    gwc sheets spreadsheets get \
      "$SPREADSHEET_ID" | jq -r '.sheets[].properties.title'
    ;;

  help|*)
    cat <<EOF
Google Sheets sync via Google Workspace CLI (gwc)

Setup:
  go install github.com/googleworkspace/cli/cmd/gwc@latest
  gwc auth login --scopes https://www.googleapis.com/auth/spreadsheets

Commands:
  read-keywords <spreadsheet_id> [tab_name]    Read keywords from column A
  write-results <spreadsheet_id> <csv_file>    Write CSV to a sheet tab
  list-tabs <spreadsheet_id>                   List all tabs

Example workflow:
  # 1. Read keywords from your Google Sheet
  ./scripts/sheets-sync.sh read-keywords 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms Keywords > keywords.txt

  # 2. Run batch (via the web app or API)
  curl -X POST http://localhost:3000/api/projects -H 'Content-Type: application/json' \\
    -d '{"keywords":["best pool cleaners"],"profileId":1,"productsPerKeyword":5}'

  # 3. Export results as CSV
  curl http://localhost:3000/api/projects/1/export?format=csv > results.csv

  # 4. Write results back to Google Sheets
  ./scripts/sheets-sync.sh write-results 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms results.csv Results
EOF
    ;;
esac

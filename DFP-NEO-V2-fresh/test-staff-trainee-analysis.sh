#!/bin/bash

# Test script to query the staff trainee analysis API
# Usage: ./test-staff-trainee-analysis.sh [URL]
# Default URL: http://localhost:3000/api/staff-trainee-analysis

URL=${1:-"http://localhost:3000/api/staff-trainee-analysis"}

echo "Querying: $URL"
echo ""

curl -s "$URL" | python3 -m json.tool

echo ""
echo "Summary:"
echo "- Total Staff"
echo "- Average Primary Trainees per Staff"
echo "- Average Secondary Trainees per Staff"
echo "- Distribution of primary trainees (0, 1, 2, 3+)"
echo "- Distribution of secondary trainees (0, 1, 2, 3+)"
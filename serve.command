#!/bin/bash
# Double-click this file to serve the LIONS dashboards locally, then open them in your browser.
cd "$(dirname "$0")"
PORT=8000
echo "Serving the LIONS dashboards from:"
echo "  $(pwd)"
echo
echo "Opening http://localhost:$PORT in your browser…"
echo "Leave this window open while you use the dashboards. Press Ctrl+C here to stop."
( sleep 1; open "http://localhost:$PORT" ) &
python3 -m http.server "$PORT"

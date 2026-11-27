#!/usr/bin/env bash
set -euo pipefail

# Local macOS launchd installer for Job Hunter Agent for Fabien Lufbery
# Schedules server sync at 09:00 and 18:00 local time (Europe/Paris on macOS).

APP_URL="${APP_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-}"
PLIST_PATH="$HOME/Library/LaunchAgents/com.fabienlufbery.jobhunter.sync.plist"

if [ -z "$CRON_SECRET" ]; then
  echo "Usage: CRON_SECRET=<your-secret> [APP_URL=https://...] bash scripts/install-macos-launchd.sh"
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.fabienlufbery.jobhunter.sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/curl</string>
    <string>-fsS</string>
    <string>-X</string>
    <string>POST</string>
    <string>-H</string>
    <string>Authorization: Bearer ${CRON_SECRET}</string>
    <string>${APP_URL%/}/api/cron/sync?force=true</string>
  </array>
  <key>StartCalendarInterval</key>
  <array>
    <dict>
      <key>Hour</key><integer>9</integer>
      <key>Minute</key><integer>0</integer>
    </dict>
    <dict>
      <key>Hour</key><integer>18</integer>
      <key>Minute</key><integer>0</integer>
    </dict>
  </array>
  <key>StandardOutPath</key>
  <string>${HOME}/Library/Logs/job-hunter-sync.out.log</string>
  <key>StandardErrorPath</key>
  <string>${HOME}/Library/Logs/job-hunter-sync.err.log</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"
echo "Installed launchd agent at $PLIST_PATH (09:00 & 18:00 daily)."

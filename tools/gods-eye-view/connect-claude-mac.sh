#!/bin/bash
# Connects God's Eye View to the Claude app for Mac, so you ask Claude to show
# places, flights, ships and fires instead of using the OpenAI voice agent.
# It uses the app's built-in MCP server and your normal Claude plan (no API key).
#
# Run setup-mac.sh first, then run this from Terminal with:
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/AzezAlbassam/albassam-office/claude/gods-eye-view-setup-dj6bye/tools/gods-eye-view/connect-claude-mac.sh)"
#
# What it does:
#   1. Builds the live globe Claude shows inside a chat (npm run build:panel).
#   2. Adds God's Eye View to Claude's settings, keeping a backup of the old file
#      and any other tools you already connected.
#   3. Updates the Desktop launcher so Claude's globe picks up new keys.
#   4. Restarts Claude and makes sure God's Eye View is running.

set -euo pipefail

APP_DIR="$HOME/gods-eye-view"
PRIVATE_NODE_BIN="$HOME/.gev/node/bin"
LAUNCHER="$HOME/Desktop/Gods Eye View.command"
APP_URL="http://localhost:4173"
CLAUDE_CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"

STEP="starting"
say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok() { printf '    \033[32mOK\033[0m %s\n' "$*"; }
fail() {
  printf '\n\033[1;31mStopped: %s\033[0m\n' "$*"
  printf 'Copy everything in this window and send it to Claude.\n'
  exit 1
}
trap 'fail "something went wrong while $STEP."' ERR

node_is_supported() {
  # $1 is a version like v24.21.0; the app needs 24.14+ or 26.x.
  local major minor
  major="$(printf '%s' "$1" | sed -E 's/^v([0-9]+)\..*/\1/')"
  minor="$(printf '%s' "$1" | sed -E 's/^v[0-9]+\.([0-9]+)\..*/\1/')"
  case "$major" in
    24) [ "$minor" -ge 14 ] ;;
    26) return 0 ;;
    *) return 1 ;;
  esac
}

# ---------------------------------------------------------------- checks
STEP="checking your Mac"
say "Checking God's Eye View and Claude"
[ "$(uname -s)" = "Darwin" ] || fail "this script is for macOS only."
[ -f "$APP_DIR/server/mcp/stdio.js" ] || fail "God's Eye View is not in $APP_DIR yet. Run the setup command first."
ok "God's Eye View found in $APP_DIR"

NODE_BIN_DIR=""
if [ -x "$PRIVATE_NODE_BIN/node" ] && node_is_supported "$("$PRIVATE_NODE_BIN/node" -v)"; then
  NODE_BIN_DIR="$PRIVATE_NODE_BIN"
elif command -v node >/dev/null 2>&1 && node_is_supported "$(node -v)"; then
  NODE_BIN_DIR="$(dirname "$(command -v node)")"
else
  fail "no supported Node.js found. Run the setup command first."
fi
export PATH="$NODE_BIN_DIR:$PATH"
ok "Node $(node -v)"

if [ -d "/Applications/Claude.app" ] || [ -d "$HOME/Applications/Claude.app" ]; then
  ok "Claude app found"
else
  open "https://claude.ai/download"
  fail "the Claude app for Mac is not installed. Install it from the page that just opened, sign in once, then run this again."
fi

# ---------------------------------------------------------------- 1. panel
STEP="building Claude's globe"
say "Building the globe Claude shows in chats (about a minute)"
cd "$APP_DIR"
BUILD_LOG="$(mktemp)"
if ! npm run build:panel >"$BUILD_LOG" 2>&1; then
  tail -30 "$BUILD_LOG"
  fail "the globe build failed."
fi
rm -f "$BUILD_LOG"
ok "built"

# ---------------------------------------------------------------- 2. Claude settings
STEP="updating Claude's settings"
say "Adding God's Eye View to Claude"
mkdir -p "$(dirname "$CLAUDE_CONFIG")"
node - "$CLAUDE_CONFIG" "$NODE_BIN_DIR/node" "$APP_DIR/server/mcp/stdio.js" "$APP_URL" <<'EOF'
const fs = require('fs');
const [configPath, nodePath, serverPath, apiBase] = process.argv.slice(2);
let config = {};
if (fs.existsSync(configPath)) {
  const text = fs.readFileSync(configPath, 'utf8');
  if (text.trim()) {
    try {
      config = JSON.parse(text);
    } catch {
      console.error(`Claude's settings file is not valid JSON, so it was left unchanged: ${configPath}`);
      process.exit(2);
    }
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      console.error(`Claude's settings file has an unexpected shape, so it was left unchanged: ${configPath}`);
      process.exit(2);
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(configPath, `${configPath}.backup-${stamp}`);
  }
}
if (!config.mcpServers || typeof config.mcpServers !== 'object' || Array.isArray(config.mcpServers))
  config.mcpServers = {};
config.mcpServers['gods-eye-view'] = {
  command: nodePath,
  args: [serverPath, '--api-base', apiBase],
};
fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
EOF
ok "Claude can now use God's Eye View"

# ---------------------------------------------------------------- 3. launcher
# Keep this launcher in sync with the one in setup-mac.sh.
STEP="updating the Desktop launcher"
say "Updating the Desktop launcher"
mkdir -p "$(dirname "$LAUNCHER")"
cat > "$LAUNCHER" <<EOF
#!/bin/bash
# Starts God's Eye View and opens it in your browser. Close this window to stop it.
export PATH="$NODE_BIN_DIR:\$PATH"
cd "$APP_DIR" || exit 1
if curl -fs -o /dev/null "$APP_URL"; then
  echo "God's Eye View is already running. Opening it."
  open "$APP_URL"
  exit 0
fi
# Claude's in-chat globe copies your keys when it is built, so rebuild it after keys change.
if [ -f dist/panel/index.html ] && [ -f .env ] && [ .env -nt dist/panel/index.html ]; then
  echo "Updating the globe Claude shows, because your keys changed..."
  npm run build:panel >/dev/null 2>&1 || echo "Could not update Claude's globe. The app itself still works."
fi
( until curl -fs -o /dev/null "$APP_URL"; do sleep 1; done; open "$APP_URL" ) &
exec npm run dev
EOF
chmod +x "$LAUNCHER"
ok "the Desktop icon now keeps Claude's globe up to date"

# ---------------------------------------------------------------- 4. restart Claude
STEP="restarting Claude"
say "Restarting Claude so it loads God's Eye View"
if pgrep -xq Claude; then
  printf '    Claude will close and reopen. Your chats are saved.\n'
  pkill -x Claude || true
  for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
    pgrep -xq Claude || break
    sleep 0.5
  done
fi
open -a Claude
ok "Claude reopened"

# ---------------------------------------------------------------- 5. app running
STEP="starting God's Eye View"
printf '\n\033[1;32mDone.\033[0m In Claude, start a NEW chat (not the Code tab) and ask:\n'
printf '    Show Riyadh in God'"'"'s Eye View with flights on.\n'
printf 'God'"'"'s Eye View must be running while you use it from Claude.\n'
if curl -fs -o /dev/null "$APP_URL"; then
  ok "God's Eye View is already running"
  exit 0
fi
printf 'Starting it now. Keep this window open, or next time double-click the Desktop icon.\n\n'
trap - ERR
exec npm run dev

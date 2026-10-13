#!/bin/bash
# One-step setup for God's Eye View (github.com/bilawalsidhu/gods-eye-view) on a Mac.
#
# Run it from Terminal with:
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/AzezAlbassam/albassam-office/claude/gods-eye-view-setup-dj6bye/tools/gods-eye-view/setup-mac.sh)"
#
# What it does, without asking for your password:
#   1. Checks macOS, Node.js (needs 24.14+ or 26.x, not 25) and git.
#   2. If Node is missing or the wrong version, installs Node 24 LTS privately in
#      ~/.gev/node (checksum verified). It does not touch any Node you already have.
#   3. Gets the app into ~/gods-eye-view (git clone, or a download if git is missing).
#   4. Runs npm ci and npm run doctor.
#   5. Puts a "Gods Eye View" launcher on your Desktop for next time.
#   6. Starts the app and opens http://localhost:4173 with the POWER UP panel open.
#
# Safe to run again: it reuses what is already there.

set -euo pipefail

NODE_VERSION="v24.21.0"
APP_REPO="https://github.com/bilawalsidhu/gods-eye-view.git"
APP_TARBALL="https://codeload.github.com/bilawalsidhu/gods-eye-view/tar.gz/refs/heads/main"
APP_DIR="$HOME/gods-eye-view"
GEV_HOME="$HOME/.gev"
PRIVATE_NODE="$GEV_HOME/node"
LAUNCHER="$HOME/Desktop/Gods Eye View.command"
APP_URL="http://localhost:4173"

STEP="starting"
say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok() { printf '    \033[32mOK\033[0m %s\n' "$*"; }
fail() {
  printf '\n\033[1;31mSetup stopped: %s\033[0m\n' "$*"
  printf 'Copy everything in this window and send it to Claude.\n'
  exit 1
}
trap 'fail "something went wrong while $STEP."' ERR

# ---------------------------------------------------------------- 1. macOS
STEP="checking macOS"
say "Checking your Mac"
[ "$(uname -s)" = "Darwin" ] || fail "this script is for macOS only."
MACOS_VERSION="$(sw_vers -productVersion)"
MACOS_MAJOR="$(printf '%s' "$MACOS_VERSION" | cut -d. -f1)"
MACOS_MINOR="$(printf '%s' "$MACOS_VERSION" | cut -s -d. -f2)"
MACOS_MINOR="${MACOS_MINOR:-0}"
if [ "$MACOS_MAJOR" -lt 13 ] || { [ "$MACOS_MAJOR" -eq 13 ] && [ "$MACOS_MINOR" -lt 5 ]; }; then
  fail "your Mac runs macOS $MACOS_VERSION, and Node 24 needs macOS 13.5 (Ventura) or newer. Update it in System Settings (System Preferences on older Macs) > Software Update, then run this again."
fi
# Apple Silicon reports x86_64 inside Rosetta, so ask the hardware directly.
if [ "$(sysctl -n hw.optional.arm64 2>/dev/null || echo 0)" = "1" ]; then
  NODE_ARCH="arm64"
else
  NODE_ARCH="x64"
fi
ok "macOS $MACOS_VERSION ($NODE_ARCH)"

# ---------------------------------------------------------------- 2. Node
STEP="checking Node.js"
say "Checking Node.js (needs 24.14 or newer 24.x, or 26.x)"
node_is_supported() {
  # $1 is a version like v24.21.0
  local major minor
  major="$(printf '%s' "$1" | sed -E 's/^v([0-9]+)\..*/\1/')"
  minor="$(printf '%s' "$1" | sed -E 's/^v[0-9]+\.([0-9]+)\..*/\1/')"
  case "$major" in
    24) [ "$minor" -ge 14 ] ;;
    26) return 0 ;;
    *) return 1 ;;
  esac
}

NODE_BIN_DIR=""
if [ -x "$PRIVATE_NODE/bin/node" ] && node_is_supported "$("$PRIVATE_NODE/bin/node" -v)"; then
  NODE_BIN_DIR="$PRIVATE_NODE/bin"
  ok "using Node $("$PRIVATE_NODE/bin/node" -v) installed earlier by this script"
elif command -v node >/dev/null 2>&1 && node_is_supported "$(node -v)"; then
  NODE_BIN_DIR="$(dirname "$(command -v node)")"
  ok "Node $(node -v) is already installed and supported"
else
  if command -v node >/dev/null 2>&1; then
    printf '    Found Node %s, which this app does not support. Installing Node %s just for this app.\n' "$(node -v)" "$NODE_VERSION"
  else
    printf '    Node is not installed. Installing Node %s just for this app.\n' "$NODE_VERSION"
  fi
  STEP="downloading Node.js"
  NODE_FILE="node-$NODE_VERSION-darwin-$NODE_ARCH.tar.gz"
  TMP_DIR="$(mktemp -d)"
  curl -fL --progress-bar -o "$TMP_DIR/$NODE_FILE" "https://nodejs.org/dist/$NODE_VERSION/$NODE_FILE"
  curl -fsSL -o "$TMP_DIR/SHASUMS256.txt" "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt"
  STEP="verifying the Node.js download"
  EXPECTED="$(grep "  $NODE_FILE\$" "$TMP_DIR/SHASUMS256.txt" | cut -d' ' -f1)"
  ACTUAL="$(shasum -a 256 "$TMP_DIR/$NODE_FILE" | cut -d' ' -f1)"
  [ -n "$EXPECTED" ] && [ "$EXPECTED" = "$ACTUAL" ] || fail "the Node.js download did not match its checksum."
  STEP="installing Node.js"
  rm -rf "$PRIVATE_NODE"
  mkdir -p "$PRIVATE_NODE"
  tar -xzf "$TMP_DIR/$NODE_FILE" -C "$PRIVATE_NODE" --strip-components=1
  rm -rf "$TMP_DIR"
  NODE_BIN_DIR="$PRIVATE_NODE/bin"
  ok "installed Node $("$PRIVATE_NODE/bin/node" -v) in $PRIVATE_NODE"
fi
export PATH="$NODE_BIN_DIR:$PATH"
ok "npm $(npm -v)"

# ---------------------------------------------------------------- 3. git + app
STEP="checking git"
say "Checking git"
HAVE_GIT=0
GIT_PATH="$(command -v git 2>/dev/null || true)"
# /usr/bin/git is only a stub until Apple's command line tools are installed;
# calling it then pops up an install dialog, so check for the tools first.
if [ -n "$GIT_PATH" ] && { [ "$GIT_PATH" != "/usr/bin/git" ] || xcode-select -p >/dev/null 2>&1; }; then
  HAVE_GIT=1
  ok "$(git --version)"
else
  printf '    git is not installed. Downloading the app directly instead (git is not needed to run it).\n'
fi

STEP="getting the app"
say "Getting God's Eye View into $APP_DIR"
if [ -d "$APP_DIR/.git" ] && [ "$HAVE_GIT" = 1 ]; then
  if git -C "$APP_DIR" pull --ff-only --quiet; then
    ok "updated existing copy"
  else
    ok "kept existing copy (could not update it, which is fine)"
  fi
elif [ -f "$APP_DIR/package.json" ]; then
  ok "using existing copy"
elif [ -e "$APP_DIR" ]; then
  fail "$APP_DIR already exists but is not the app. Rename or move it, then run this again."
elif [ "$HAVE_GIT" = 1 ]; then
  git clone --quiet "$APP_REPO" "$APP_DIR"
  ok "cloned $APP_REPO"
else
  TMP_DIR="$(mktemp -d)"
  curl -fL --progress-bar -o "$TMP_DIR/app.tar.gz" "$APP_TARBALL"
  mkdir -p "$TMP_DIR/app"
  tar -xzf "$TMP_DIR/app.tar.gz" -C "$TMP_DIR/app" --strip-components=1
  mv "$TMP_DIR/app" "$APP_DIR"
  rm -rf "$TMP_DIR"
  ok "downloaded the latest version"
fi
cd "$APP_DIR"

# ---------------------------------------------------------------- 4. install + doctor
STEP="running npm ci"
say "Installing the app's packages (npm ci, takes a minute or two)"
# Puppeteer's browser download is only for the project's QA scripts, not the app.
PUPPETEER_SKIP_DOWNLOAD=1 npm ci --no-fund --no-audit
ok "packages installed"

STEP="running npm run doctor"
say "Running the setup doctor"
npm run doctor

# ---------------------------------------------------------------- 5. launcher
STEP="creating the Desktop launcher"
say "Adding a launcher to your Desktop"
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
( until curl -fs -o /dev/null "$APP_URL"; do sleep 1; done; open "$APP_URL" ) &
exec npm run dev
EOF
chmod +x "$LAUNCHER"
ok "double-click \"Gods Eye View\" on your Desktop to start it next time"

# ---------------------------------------------------------------- 6. start
STEP="starting the app"
say "Starting God's Eye View"
if curl -fs -o /dev/null "$APP_URL"; then
  ok "it is already running"
  open "$APP_URL/?setup=1"
  exit 0
fi
printf '    Your browser will open on %s with the POWER UP panel showing.\n' "$APP_URL"
printf '    Keep this window open while you use the app. Closing it stops the app.\n\n'
( until curl -fs -o /dev/null "$APP_URL"; do sleep 1; done; open "$APP_URL/?setup=1" ) &
trap - ERR
exec npm run dev

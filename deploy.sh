#!/bin/bash
# 플러그인 런타임 파일을 vault의 .obsidian/plugins/graph-styler/ 로 복사.
# 사용: ./deploy.sh [/path/to/vault]   (기본: research-wiki)
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
VAULT="${1:-/Users/choemun-yeong/Vaults/research-wiki}"
DEST="$VAULT/.obsidian/plugins/graph-styler"
mkdir -p "$DEST"
cp "$SRC/main.js" "$SRC/manifest.json" "$DEST/"
echo "deployed -> $DEST   (옵시디언에서 'Reload app without saving')"

#!/usr/bin/env zsh
set -euo pipefail

export PATH="/opt/homebrew/bin:/Users/pedroguilherme/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export LIVETIME_UID="${LIVETIME_UID:-58856059-c4fd-4626-aea7-42aefc048eec}"
export SCRAPER_PORT="${SCRAPER_PORT:-4010}"
export LIVETIME_HEADLESS="${LIVETIME_HEADLESS:-true}"
export LIVETIME_SCRAPER_POLL_MS="${LIVETIME_SCRAPER_POLL_MS:-2000}"

cd "/Users/pedroguilherme/PROJETOS/KARTODROMO"
exec npm run scraper

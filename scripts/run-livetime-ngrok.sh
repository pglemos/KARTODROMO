#!/usr/bin/env zsh
set -euo pipefail

export PATH="/opt/homebrew/bin:/Users/pedroguilherme/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

exec ngrok http --url=repeatable-sanora-feignedly.ngrok-free.dev 4010 --log=stdout

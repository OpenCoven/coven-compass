#!/bin/sh
# Kept so the command documented in #6 keeps working. verify-all is the one command.
exec node "$(dirname "$0")/verify-all.mjs" "$@"

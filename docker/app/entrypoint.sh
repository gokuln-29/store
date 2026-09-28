#!/bin/sh
# Container start: drop pages prerendered from the empty build database, then run the server.
set -e
node docker/clear-prerendered.mjs .next
exec node server.js

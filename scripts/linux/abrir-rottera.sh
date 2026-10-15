#!/bin/sh
# Starts Rottera from this folder.
# Chromium isolates each page in a sandbox. That needs either chrome-sandbox owned by root with the
# setuid bit (instalar.sh offers to do it) or user namespaces, which Ubuntu 24.04 and later block for
# programs outside the system. With neither available the app would not open, so it starts without
# that isolation: Rottera only shows its own pages, never sites from the internet.
DIR="$(dirname "$(readlink -f "$0")")"
if [ "$(stat -c %u:%a "$DIR/chrome-sandbox" 2>/dev/null)" = "0:4755" ]; then
  exec "$DIR/rottera" "$@"
fi
if [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null)" = "1" ] ||
   [ "$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null)" = "0" ]; then
  exec "$DIR/rottera" --no-sandbox "$@"
fi
exec "$DIR/rottera" "$@"

#!/bin/sh
# Adds Rottera to the applications menu of this user (no administrator needed), pointing at this folder.
# Optional: with sudo, sets up Chromium's sandbox helper so the app runs fully isolated.
# To remove: ./instalar.sh --remover
set -e
DIR="$(dirname "$(readlink -f "$0")")"
APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
ICONS="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/512x512/apps"

if [ "$1" = "--remover" ]; then
  rm -f "$APPS/rottera.desktop" "$ICONS/rottera.png"
  command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$APPS" || true
  echo "Rottera saiu do menu. Para apagar o programa, apague esta pasta."
  echo "Os dados do programa ficam em ~/.config/Rottera."
  exit 0
fi

mkdir -p "$APPS" "$ICONS"
cp "$DIR/rottera.png" "$ICONS/rottera.png"
cat > "$APPS/rottera.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Rottera
Comment=Editor de roteiros
Exec="$DIR/abrir-rottera.sh"
Icon=rottera
Terminal=false
Categories=Office;TextEditor;
StartupWMClass=Rottera
DESKTOP
chmod +x "$APPS/rottera.desktop"
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$APPS" || true
echo "Rottera está no menu de aplicativos."

if [ "$(stat -c %u:%a "$DIR/chrome-sandbox")" != "0:4755" ] && command -v sudo >/dev/null 2>&1; then
  echo
  echo "Opcional: ativar o isolamento do Chromium (pede a sua senha de administrador)."
  printf "Ativar agora? [s/N] "
  read -r answer || answer=""
  case "$answer" in
    s|S|sim|Sim)
      sudo chown root:root "$DIR/chrome-sandbox"
      sudo chmod 4755 "$DIR/chrome-sandbox"
      echo "Isolamento ativado."
      ;;
    *) echo "Tudo bem: o Rottera abre do mesmo jeito." ;;
  esac
fi

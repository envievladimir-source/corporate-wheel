#!/bin/bash
cd "$(dirname "$0")"

ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  BIN="./corporate-wheel-arm64"
else
  BIN="./corporate-wheel-x64"
fi

# Делаем файлы исполняемыми (нужно один раз, если запускаешь впервые не через bash)
chmod +x "$0" "$BIN" 2>/dev/null

# Снимаем карантин macOS (иначе будет предупреждение "неизвестный разработчик")
xattr -dr com.apple.quarantine . 2>/dev/null

# Ad-hoc подпись — без неё macOS может не дать запустить непдписанный бинарник
if command -v codesign >/dev/null 2>&1; then
  codesign --force --deep --sign - "$BIN" 2>/dev/null
fi

echo "Запускаю Corporate Wheel ($ARCH)..."
echo "Сайт откроется в браузере автоматически."
echo "Чтобы остановить сервер — закрой это окно или нажми Ctrl+C."
echo ""

"$BIN"

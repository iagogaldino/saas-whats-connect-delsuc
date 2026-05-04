#!/usr/bin/env bash
# Executado no servidor Ubuntu. Argumento: caminho do ficheiro .pub copiado via scp (ex. /tmp/gha_delsuc.pub)
set -euo pipefail

REMOTE_PUB="${1:?usage: $0 /caminho/para/chave.pub}"

mkdir -p ~/.ssh
chmod 700 ~/.ssh
chmod go-w "$HOME" 2>/dev/null || true

tr -d '\r' < "$REMOTE_PUB" > /tmp/gha_clean.pub

if grep -Fxqf /tmp/gha_clean.pub ~/.ssh/authorized_keys 2>/dev/null; then
  echo "Chave publica ja estava em authorized_keys."
else
  cat /tmp/gha_clean.pub >> ~/.ssh/authorized_keys
  echo "Chave publica acrescentada a authorized_keys."
fi

chmod 600 ~/.ssh/authorized_keys
chown "$(id -un):$(id -gn)" ~/.ssh/authorized_keys 2>/dev/null || true

rm -f /tmp/gha_clean.pub
rm -f "$REMOTE_PUB"

echo "--- ssh-keygen -l ~/.ssh/authorized_keys ---"
ssh-keygen -l -f ~/.ssh/authorized_keys

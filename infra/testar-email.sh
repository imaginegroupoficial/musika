#!/usr/bin/env bash
# Testa o SMTP do Musika enviando um e-mail de verdade e mostra o erro exato se falhar.
# Uso: bash infra/testar-email.sh [destino@exemplo.com]
# Lê SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e SMTP_FROM do ambiente ou de /opt/musika/.env
set -uo pipefail
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"
get() { local v="${!1:-}"; [ -z "$v" ] && [ -f "$ENV_FILE" ] && v="$(grep "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-)"; printf '%s' "$v"; }
HOST="$(get SMTP_HOST)"; PORT="$(get SMTP_PORT)"; PORT="${PORT:-465}"
USER_="$(get SMTP_USER)"; PASS="$(get SMTP_PASS)"; FROM="$(get SMTP_FROM)"
TO="${1:-$(get ADMIN_EMAIL)}"
if [ -z "$HOST" ]; then echo "SMTP_HOST vazio: nenhum SMTP configurado."; exit 2; fi
if [ -z "$TO" ]; then echo "Informe o destino: bash infra/testar-email.sh voce@exemplo.com"; exit 2; fi
if [ "$PORT" = "465" ]; then URL="smtps://${HOST}:${PORT}"; TLS=(); else URL="smtp://${HOST}:${PORT}"; TLS=(--ssl-reqd); fi
MSG="$(mktemp)"
printf 'From: Musika <%s>\r\nTo: <%s>\r\nSubject: Teste de e-mail do Musika\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nSe voce recebeu isto, o SMTP do Musika esta funcionando.\r\n' "$FROM" "$TO" > "$MSG"
echo "Servidor: ${HOST}:${PORT}  Usuário: ${USER_}  Remetente: ${FROM}  Destino: ${TO}"
OUT="$(curl -sS --max-time 25 --url "$URL" "${TLS[@]}" --mail-from "$FROM" --mail-rcpt "$TO" --user "${USER_}:${PASS}" --upload-file "$MSG" 2>&1)"
CODE=$?
rm -f "$MSG"
if [ $CODE -eq 0 ]; then echo "OK: e-mail enviado. Confira a caixa de entrada (e o spam) de ${TO}."; exit 0; fi
echo "FALHOU: $OUT"
case "$OUT" in
  *"Login denied"*|*"535"*|*"authentication"*|*"Authentication"*) echo "Dica: usuário ou senha do SMTP errados. No Resend, o usuário é 'resend' e a senha é a chave da API (re_...).";;
  *"553"*|*"550"*|*"554"*|*"sender"*|*"Sender"*|*"not verified"*|*"domain"*) echo "Dica: o remetente ${FROM} não é aceito. No Resend, verifique o domínio; na Hostinger, o remetente precisa ser o mesmo e-mail do usuário (${USER_}).";;
  *"timed out"*|*"Couldn't connect"*|*"Connection refused"*) echo "Dica: a VPS não alcança ${HOST}:${PORT}. Tente a porta 587 (SMTP_PORT=587).";;
esac
exit 1

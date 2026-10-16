#!/usr/bin/env bash
# Musika: instalação completa numa VPS Ubuntu 24.04 (Hostinger KVM 8).
# Uso (uma linha no console da Hostinger):
#   git clone <repo> /opt/musika && bash /opt/musika/infra/install.sh
# Rodar de novo é seguro: só aplica o que falta e reconstrói o site.
set -euo pipefail

DOMAIN="${DOMAIN:-musika.tech}"
APP_ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"
# valores já salvos numa instalação anterior continuam valendo se não forem passados de novo
prev() { [ -f "$APP_ENV_FILE" ] && grep "^$1=" "$APP_ENV_FILE" | head -1 | cut -d= -f2- || true; }
ACME_EMAIL="${ACME_EMAIL:-$(prev ACME_EMAIL)}"
ACME_EMAIL="${ACME_EMAIL:-admin@${DOMAIN}}"
ADMIN_EMAIL="${ADMIN_EMAIL:-$(prev ADMIN_EMAIL)}"
ADMIN_EMAIL="${ADMIN_EMAIL:-$ACME_EMAIL}"
PAGARME_SECRET_KEY="${PAGARME_SECRET_KEY:-$(prev PAGARME_SECRET_KEY)}"
PAGARME_WEBHOOK_TOKEN="${PAGARME_WEBHOOK_TOKEN:-$(prev PAGARME_WEBHOOK_TOKEN)}"
PAGARME_WEBHOOK_TOKEN="${PAGARME_WEBHOOK_TOKEN:-$(openssl rand -hex 20)}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SB_DIR="/opt/musika-supabase"
SB_SRC="/opt/supabase-src"

log() { printf '\n\033[1;35m[musika]\033[0m %s\n' "$*"; }
set_env() { # arquivo chave valor
  local f="$1" k="$2" v="$3"
  if grep -q "^${k}=" "$f"; then
    local esc; esc=$(printf '%s' "$v" | sed -e 's/[\/&|]/\\&/g')
    sed -i "s|^${k}=.*|${k}=${esc}|" "$f"
  else
    printf '%s=%s\n' "$k" "$v" >> "$f"
  fi
}
get_env() { grep "^$2=" "$1" | head -1 | cut -d= -f2-; }

[ "$(id -u)" = "0" ] || { echo "Rode como root"; exit 1; }

log "1/8 Pacotes base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl openssl ca-certificates jq >/dev/null

log "2/8 Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

log "3/8 Liberando as portas 80 e 443 (nginx/apache nativos da Hostinger)"
for svc in nginx apache2; do
  systemctl stop "$svc" 2>/dev/null || true
  systemctl disable "$svc" 2>/dev/null || true
done

docker network inspect musika_net >/dev/null 2>&1 || docker network create musika_net

log "4/8 Supabase self-hosted"
if [ ! -d "$SB_DIR" ]; then
  rm -rf "$SB_SRC"
  git clone --depth 1 --filter=blob:none --sparse https://github.com/supabase/supabase "$SB_SRC"
  git -C "$SB_SRC" sparse-checkout set docker
  cp -r "$SB_SRC/docker" "$SB_DIR"
fi
cd "$SB_DIR"
if [ ! -f .env ]; then
  cp .env.example .env
  sh utils/generate-keys.sh --update-env >/dev/null
  set_env .env SITE_URL "https://${DOMAIN}"
  set_env .env ADDITIONAL_REDIRECT_URLS "https://${DOMAIN}/**,https://www.${DOMAIN}/**"
  set_env .env API_EXTERNAL_URL "https://db.${DOMAIN}"
  set_env .env SUPABASE_PUBLIC_URL "https://db.${DOMAIN}"
  set_env .env ENABLE_EMAIL_SIGNUP true
  set_env .env ENABLE_EMAIL_AUTOCONFIRM true
  set_env .env DISABLE_SIGNUP false
  set_env .env POOLER_TENANT_ID musika
  set_env .env DASHBOARD_USERNAME musika
  # o gateway só escuta localmente; o acesso público passa pelo Traefik
  set_env .env KONG_HTTP_PORT 127.0.0.1:8000
  set_env .env KONG_HTTPS_PORT 127.0.0.1:8443
  set_env .env API_GW_HTTP_PORT 127.0.0.1:8000
  set_env .env STUDIO_DEFAULT_ORGANIZATION Musika
  set_env .env STUDIO_DEFAULT_PROJECT Musika
fi

# o nome do gateway mudou entre versões do Supabase (kong -> api-gw)
if grep -q '^  api-gw:' docker-compose.yml; then GW=api-gw; else GW=kong; fi
cat > docker-compose.musika.yml <<EOF
services:
  ${GW}:
    networks:
      default: {}
      musika_net:
        aliases: [supabase-gw]
    labels:
      - traefik.enable=true
      - traefik.docker.network=musika_net
      - traefik.http.routers.musika-db.rule=Host(\`db.${DOMAIN}\`)
      - traefik.http.routers.musika-db.entrypoints=websecure
      - traefik.http.routers.musika-db.tls.certresolver=le
      - traefik.http.services.musika-db.loadbalancer.server.port=8000
  storage:
    environment:
      FILE_SIZE_LIMIT: 524288000
  supavisor:
    # pooler do Postgres só acessível de dentro da VPS
    ports: !override
      - "127.0.0.1:5432:5432"
      - "127.0.0.1:6543:6543"
networks:
  musika_net:
    external: true
EOF
COMPOSE_FILE_BASE="$(get_env .env COMPOSE_FILE)"
COMPOSE_FILE_BASE="${COMPOSE_FILE_BASE:-docker-compose.yml}"
case "$COMPOSE_FILE_BASE" in *docker-compose.musika.yml*) ;; *) set_env .env COMPOSE_FILE "${COMPOSE_FILE_BASE}:docker-compose.musika.yml" ;; esac

docker compose -p supabase pull -q
docker compose -p supabase up -d

log "5/8 Esperando o Postgres"
for i in $(seq 1 90); do
  if docker exec supabase-db pg_isready -U postgres -h 127.0.0.1 >/dev/null 2>&1; then break; fi
  sleep 2
done
sleep 5
PGPASS="$(get_env .env POSTGRES_PASSWORD)"
psql_db() { docker exec -i -e PGPASSWORD="$PGPASS" supabase-db psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }

log "6/8 Migrations do Musika"
psql_db -c "create table if not exists public._musika_migrations (name text primary key, applied_at timestamptz not null default now());" >/dev/null
for f in "$APP_DIR"/supabase/migrations/*.sql; do
  name="$(basename "$f")"
  done_already="$(psql_db -tAc "select 1 from public._musika_migrations where name = '${name}'")"
  if [ "$done_already" = "1" ]; then echo "  = $name (já aplicada)"; continue; fi
  echo "  + $name"
  psql_db < "$f"
  psql_db -c "insert into public._musika_migrations (name) values ('${name}')" >/dev/null
done
# e-mails de administrador: contas novas entram como admin e as existentes são promovidas
ADMIN_JSON="$(printf '%s' "$ADMIN_EMAIL" | tr 'A-Z' 'a-z' | tr ',; ' '\n\n\n' | sed '/^$/d' | jq -R . | jq -sc .)"
psql_db -c "update public.settings set value = (select jsonb_agg(distinct e) from jsonb_array_elements_text(value || '${ADMIN_JSON}'::jsonb) e) where key = 'admin_emails';" >/dev/null
psql_db -c "update public.profiles p set is_admin = true from auth.users u where u.id = p.id and lower(u.email) in (select jsonb_array_elements_text(value) from public.settings where key = 'admin_emails');" >/dev/null
# avisa o PostgREST para recarregar o schema
psql_db -c "notify pgrst, 'reload schema';" >/dev/null

log "7/8 Subindo site, worker e entrega de áudio"
cd "$APP_DIR"
ANON_KEY="$(get_env "$SB_DIR/.env" ANON_KEY)"
SERVICE_ROLE_KEY="$(get_env "$SB_DIR/.env" SERVICE_ROLE_KEY)"
cat > .env <<EOF
DOMAIN=${DOMAIN}
ACME_EMAIL=${ACME_EMAIL}
ADMIN_EMAIL=${ADMIN_EMAIL}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
PAGARME_SECRET_KEY=${PAGARME_SECRET_KEY}
PAGARME_WEBHOOK_TOKEN=${PAGARME_WEBHOOK_TOKEN}
EOF
chmod 600 .env "$SB_DIR/.env"
docker compose -p musika up -d --build

log "8/8 Backup diário do banco (03:30) em /opt/musika-backups"
mkdir -p /opt/musika-backups
cat > /etc/cron.d/musika-backup <<EOF
30 3 * * * root docker exec -e PGPASSWORD=${PGPASS} supabase-db pg_dump -h 127.0.0.1 -U postgres -d postgres -Fc > /opt/musika-backups/db-\$(date +\%F).dump && find /opt/musika-backups -name 'db-*.dump' -mtime +14 -delete
EOF

IP="$(curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}')"
cat <<EOF

==============================================================
 Musika instalado.

 DNS (registros A apontando para ${IP}):
   ${DOMAIN}   www.${DOMAIN}   db.${DOMAIN}   media.${DOMAIN}

 Site:            https://${DOMAIN}
 Painel Supabase: https://db.${DOMAIN}
   usuário: $(get_env "$SB_DIR/.env" DASHBOARD_USERNAME)
   senha:   $(get_env "$SB_DIR/.env" DASHBOARD_PASSWORD)

 Administrador: ${ADMIN_EMAIL} (crie a conta no site com esse e-mail)

 Pagar.me: $( [ -n "$PAGARME_SECRET_KEY" ] && echo "chave configurada" || echo "SEM CHAVE. Rode de novo com PAGARME_SECRET_KEY=sk_... para ativar pagamentos" )
 Webhook para cadastrar no painel do Pagar.me (eventos order.paid e charge.paid):
   https://${DOMAIN}/api/pagarme/webhook?token=${PAGARME_WEBHOOK_TOKEN}

 Segredos: ${SB_DIR}/.env e ${APP_DIR}/.env (guarde cópias fora da VPS)
 Backups:  /opt/musika-backups (copie para fora da VPS também)
==============================================================
EOF

#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${ADUDOC_REMOTE_HOST:-root@vps-old.pyrosa.com.do}"
REMOTE_APP_ROOT="${ADUDOC_REMOTE_APP_ROOT:-/home/wmadudoc/public_html}"
REMOTE_DATABASE="${ADUDOC_REMOTE_DATABASE:-adudoc_db}"
TARGET_ROOT="${ADUDOC_TARGET_ROOT:-/srv/containers/apps/adudoc}"
TARGET_APP_ROOT="${TARGET_ROOT}/app"
TARGET_UPLOADS_ROOT="${TARGET_ROOT}/uploads"
TARGET_CURRENT_LINK="${TARGET_ROOT}/current"
TARGET_STORAGE_CACHE_ROOT="${TARGET_APP_ROOT}/storage/cache"
TARGET_STORAGE_LOGS_ROOT="${TARGET_APP_ROOT}/storage/logs"
TARGET_DB="${ADUDOC_TARGET_DATABASE:-app_adudoc}"
TARGET_DB_ROLE="${ADUDOC_TARGET_DB_ROLE:-app_adudoc}"
TARGET_CANONICAL_DOMAIN="${ADUDOC_CANONICAL_DOMAIN:-adudoc.com}"
TARGET_ALIASES="${ADUDOC_ALIASES:-www.adudoc.com}"
TARGET_BACKEND_PORT="${ADUDOC_BACKEND_PORT:-10301}"
TARGET_DB_HOST="${ADUDOC_TARGET_DB_HOST:-10.89.0.1}"
TARGET_DB_PORT="${ADUDOC_TARGET_DB_PORT:-5432}"
IMAGE_TAG="${ADUDOC_IMAGE_TAG:-registry.example.com/adudoc-app:stable}"
BUILD_IMAGE="${ADUDOC_BUILD_IMAGE:-true}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

require_command() {
  local command_name="$1"

  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Missing required command: ${command_name}" >&2
    exit 1
  fi
}

require_command ssh
require_command rsync
require_command podman
require_command psql

if [[ "${BUILD_IMAGE}" == "true" ]]; then
  "${SRC_ROOT}/scripts/manager/build-app-runtime-image.sh" "${IMAGE_TAG}"
fi

install -d \
  "${TARGET_ROOT}" \
  "${TARGET_APP_ROOT}" \
  "${TARGET_UPLOADS_ROOT}" \
  "${TARGET_STORAGE_CACHE_ROOT}" \
  "${TARGET_STORAGE_LOGS_ROOT}" \
  /etc/containers/systemd/env

rsync \
  -aH \
  --delete \
  --exclude "cgi-bin/" \
  --exclude "storage/cache/" \
  --exclude "storage/logs/" \
  "${REMOTE_HOST}:${REMOTE_APP_ROOT}/" \
  "${TARGET_APP_ROOT}/"

chown -R root:root "${TARGET_APP_ROOT}"
chmod -R u=rwX,go=rX "${TARGET_APP_ROOT}"
chmod -R 0777 "${TARGET_UPLOADS_ROOT}" "${TARGET_STORAGE_CACHE_ROOT}" "${TARGET_STORAGE_LOGS_ROOT}"

ln -sfn "${TARGET_APP_ROOT}" "${TARGET_CURRENT_LINK}"

cat > "${TARGET_APP_ROOT}/config/database.php" <<PHP
<?php
\$driver = getenv('DB_ENGINE') ?: 'pgsql';
if (\$driver === 'postgresql') {
    \$driver = 'pgsql';
}

return [
    'driver' => \$driver,
    'host' => getenv('DB_HOST') ?: '/run/postgresql',
    'port' => (int) (getenv('DB_PORT') ?: ${TARGET_DB_PORT}),
    'database' => getenv('DB_NAME') ?: '${TARGET_DB}',
    'username' => getenv('DB_USER') ?: '${TARGET_DB_ROLE}',
    'password' => getenv('DB_PASSWORD') ?: '',
];
PHP

LEGACY_DB_PASSWORD="$(
  ssh "${REMOTE_HOST}" \
    "php -r '\$config = require \"${REMOTE_APP_ROOT}/config/database.php\"; echo \$config[\"password\"];'"
)"
ESCAPED_PASSWORD="${LEGACY_DB_PASSWORD//\'/\'\'}"

sudo -u postgres psql postgres <<SQL
ALTER ROLE ${TARGET_DB_ROLE} WITH LOGIN PASSWORD '${ESCAPED_PASSWORD}';
SQL

sudo -u postgres psql "${TARGET_DB}" <<SQL
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public AUTHORIZATION ${TARGET_DB_ROLE};
GRANT ALL ON SCHEMA public TO ${TARGET_DB_ROLE};
SQL

ssh "${REMOTE_HOST}" "sudo -u postgres pg_dump --no-owner --no-privileges ${REMOTE_DATABASE}" \
  | sed '/^SET transaction_timeout = /d' \
  | sudo -u postgres psql -v ON_ERROR_STOP=1 "${TARGET_DB}"

cat > "/etc/containers/systemd/env/app-adudoc.env" <<ENV
APP_NAME=adudoc
APP_ENV=production
APP_URL=https://${TARGET_CANONICAL_DOMAIN}
APP_CANONICAL_DOMAIN=${TARGET_CANONICAL_DOMAIN}
APP_ALIASES=${TARGET_ALIASES}
APP_DATA_DIR=${TARGET_APP_ROOT}
APP_UPLOADS_DIR=${TARGET_UPLOADS_ROOT}
APP_SERVICE_NAME=app-adudoc.service
APP_CONTAINER_NAME=app-adudoc
DB_ENGINE=postgresql
DB_HOST=${TARGET_DB_HOST}
DB_PORT=${TARGET_DB_PORT}
DB_NAME=${TARGET_DB}
DB_USER=${TARGET_DB_ROLE}
DB_PASSWORD=${LEGACY_DB_PASSWORD}
ENV

cat > "/etc/containers/systemd/app-adudoc.container" <<UNIT
[Unit]
Description=Application container for adudoc
After=network-online.target
Wants=network-online.target

[Container]
ContainerName=app-adudoc
Image=${IMAGE_TAG}
PublishPort=127.0.0.1:${TARGET_BACKEND_PORT}:80
EnvironmentFile=/etc/containers/systemd/env/app-adudoc.env
Volume=${TARGET_APP_ROOT}:/var/www/html:Z
Volume=${TARGET_UPLOADS_ROOT}:/var/www/html/public/uploads:Z
Volume=${TARGET_UPLOADS_ROOT}:/var/www/html/storage/uploads:Z

[Service]
Restart=always
RestartSec=5
TimeoutStartSec=900

[Install]
WantedBy=multi-user.target
UNIT

cat > "/etc/httpd/conf.d/adudoc.conf" <<HTTPD
<VirtualHost *:80>
  ServerName ${TARGET_CANONICAL_DOMAIN}
  ServerAlias ${TARGET_ALIASES}
  ProxyPreserveHost On
  ProxyRequests Off
  ProxyPass / http://127.0.0.1:${TARGET_BACKEND_PORT}/ retry=0 timeout=120
  ProxyPassReverse / http://127.0.0.1:${TARGET_BACKEND_PORT}/
</VirtualHost>
HTTPD

systemctl daemon-reload
systemctl restart app-adudoc.service
httpd -t
systemctl reload httpd.service
curl --fail --silent --show-error "http://127.0.0.1:${TARGET_BACKEND_PORT}/" >/dev/null
curl --fail --silent --show-error -H "Host: ${TARGET_CANONICAL_DOMAIN}" "http://127.0.0.1/" >/dev/null

cat > "${TARGET_ROOT}/migration-source.txt" <<META
source_host=${REMOTE_HOST}
source_app_root=${REMOTE_APP_ROOT}
source_database=${REMOTE_DATABASE}
migrated_at=$(date -u +%FT%TZ)
image_tag=${IMAGE_TAG}
META

echo "Adudoc runtime migrated to ${TARGET_ROOT} and app-adudoc.service is active."

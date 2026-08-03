#!/bin/sh
set -eu

: "${HAVEN_USER_NAME:=Mike}"
: "${KEYCLOAK_ENABLED:=false}"
: "${KEYCLOAK_URL:=https://auth.example.com}"
: "${KEYCLOAK_REALM:=home}"
: "${KEYCLOAK_CLIENT_ID:=haven}"

cp -R /opt/haven/site/. /app/public/
exec "$@"

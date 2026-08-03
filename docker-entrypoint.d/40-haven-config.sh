#!/bin/sh
set -eu

: "${HAVEN_USER_NAME:=Mike}"
: "${KEYCLOAK_ENABLED:=false}"
: "${KEYCLOAK_URL:=https://auth.example.com}"
: "${KEYCLOAK_REALM:=home}"
: "${KEYCLOAK_CLIENT_ID:=haven}"

export HAVEN_USER_NAME KEYCLOAK_ENABLED KEYCLOAK_URL KEYCLOAK_REALM KEYCLOAK_CLIENT_ID
cp -R /opt/haven/site/. /usr/share/nginx/html/
envsubst < /opt/haven/config.template.js > /usr/share/nginx/html/config.js

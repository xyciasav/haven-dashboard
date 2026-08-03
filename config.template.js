export default {
  user: { name: '${HAVEN_USER_NAME}' },
  auth: {
    enabled: ${KEYCLOAK_ENABLED},
    url: '${KEYCLOAK_URL}',
    realm: '${KEYCLOAK_REALM}',
    clientId: '${KEYCLOAK_CLIENT_ID}',
    adapterUrl: 'https://cdn.jsdelivr.net/npm/keycloak-js/+esm'
  }
};

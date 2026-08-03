export default {
  user: { name: 'Mike' },
  auth: {
    enabled: false,
    url: 'https://auth.example.com',
    realm: 'home',
    clientId: 'haven',
    adapterUrl: 'https://cdn.jsdelivr.net/npm/keycloak-js/+esm'
  },
  // App URLs and integration secrets should eventually be served by a backend.
  // Never put Home Assistant tokens or other private credentials in this file.
};

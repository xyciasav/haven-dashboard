# Haven

Current release: **v0.6.1** · Docker image: `haven-dashboard:0.6.1`

A calm, self-hosted home dashboard inspired by Organizr: a user-managed application launcher, live weather, Plex activity, Home Assistant controls and calendars, arr integrations, and Keycloak authentication.

## Run it

Haven has no frontend build step. The supported deployment is Docker Compose; for development, run the Node server with `PUBLIC_DIR` pointing to this folder and `DATA_DIR` pointing to a writable test folder.

Static-only web servers do not provide weather, Plex, calendar, authentication settings, or integration APIs.

## Deploy with Portainer

The repository includes a production Node image and a Portainer-ready `docker-compose.yml`.

1. In Portainer, open **Stacks** → **Add stack**.
2. Choose **Repository** and paste this repository's GitHub URL.
3. Use the default compose path `docker-compose.yml` and deploy the stack.
4. Open `http://YOUR-SERVER:43127`.

Before deploying, replace the setup token and optionally add Home Assistant in Portainer:

```yaml
HAVEN_SETUP_TOKEN: generate-a-long-random-value
HOME_ASSISTANT_URL: https://home-assistant.your-domain.com
HOME_ASSISTANT_TOKEN: paste-in-portainer-do-not-commit
```

For a reverse proxy, point the public hostname at Haven's port `43127`. Add that final public URL to the Keycloak client's valid redirect URIs and web origins. The container has a `/health` endpoint, runs as a non-root user, and restarts automatically.

## Install on a phone

Haven is an installable PWA with a home-screen icon, standalone display mode, and an offline dashboard shell. Serve it through an HTTPS reverse proxy—mobile browsers require HTTPS for PWA installation and service workers.

- Android/Chrome: use Haven's **Install app** button or the browser's **Install app** menu item.
- iPhone/Safari: tap **Share** → **Add to Home Screen**.

Display preferences and application URLs are stored separately in each phone's browser. Plex tokens, calendar subscription URLs, and arr API keys are stored in the `haven-data` Docker volume and are never returned to the browser. Haven validates the signed-in user against Keycloak before proxying protected integration requests.

## Integrations

Open Haven's **Integrations** tab while signed in. The first authenticated Keycloak user becomes the integration owner and can save without repeatedly entering `HAVEN_SETUP_TOKEN`; the token remains available as a recovery key.

- **Plex:** server URL and Plex token; Haven shows recently added library items.
- **Home Assistant:** server URL, long-lived access token, optional `calendar.*` entity ID, and user-defined quick actions. Haven reads live entity state, proxies control actions, and keeps the token on the server. Portainer environment values remain supported as defaults.
- **Vikunja:** server URL and API token; Haven shows incomplete tasks assigned to the token owner. Create the token in Vikunja under Settings → API Tokens.
- **Chore app:** server URL for the read-only FastAPI service; Haven shows pending chores and reward requests and links back to the app for review.
- **Calendar:** a private ICS subscription URL from Google Calendar, Apple Calendar, Outlook, or another ICS provider.
- **Sonarr, Radarr, Lidarr, and Readarr:** server URL and API key, with connection tests.

Weather uses Open-Meteo and requires no API key. Set the location under **Settings → Dashboard**. Integration secrets remain server-side; blank token/API-key fields preserve the previously saved secret.

For Cloudflare, route your Tunnel or reverse proxy to `http://haven:3000` when it shares Haven's Docker network, or to `http://YOUR-SERVER:43127`. Use **Full (strict)** TLS mode and keep the public Keycloak redirect URI synchronized with Haven's final HTTPS hostname.

## Keycloak setup

1. Create a public OpenID Connect client in Keycloak (no client secret) with Standard Flow and PKCE enabled.
2. Add your Haven URL to **Valid redirect URIs** (for local development: `http://localhost:4173/*`).
3. Add the origin to **Web origins** (for local development: `http://localhost:4173`).
4. Open Haven's **Settings**, enter the Keycloak URL, realm, client ID, and the `HAVEN_SETUP_TOKEN` from Portainer.
5. Enable **Require Keycloak login** and save. Haven reloads and starts the login flow.

Authentication configuration is persisted in the `haven-data` Docker volume and shared by every phone. The setup token is checked by the server and is never saved in the browser.

If a Keycloak configuration prevents login, open `http://YOUR-SERVER:43127/?setup=1`. Recovery mode opens Settings so the configuration can be corrected or disabled using the setup token. LAN HTTP uses a compatibility login mode; HTTPS automatically enables PKCE S256.

For a guaranteed authentication lockout recovery, set `HAVEN_AUTH_BYPASS=true` in the Portainer stack environment and redeploy. This overrides the saved login requirement at container startup. Set it back to `false` after correcting Keycloak.

The browser uses Authorization Code Flow with PKCE. The server independently validates the access token through Keycloak before accessing protected integration routes. Home Assistant credentials remain server-side in the container environment.

Haven bundles the official Keycloak JavaScript adapter (v26.2.4) inside its image, so login does not depend on a public CDN being reachable.

For local HTTP access, Haven supplies a cryptographically secure UUID v4 implementation using `crypto.getRandomValues`, because browsers expose that primitive but restrict `crypto.randomUUID` to secure contexts. HTTPS uses the browser's native implementation and PKCE S256.

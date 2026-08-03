# Haven

A calm, self-hosted home dashboard inspired by Organizr: application launcher, weather, Home Assistant status, media updates, scenes, calendar, and Keycloak authentication.

## Run it

This first version has no build step. From this folder:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Deploy with Portainer

The repository includes a production Nginx image and a Portainer-ready `compose.yaml`.

1. In Portainer, open **Stacks** → **Add stack**.
2. Choose **Repository** and paste this repository's GitHub URL.
3. Set the compose path to `compose.yaml` and deploy the stack.
4. Open `http://YOUR-SERVER:43127`.

Before enabling authentication, edit the environment values in `compose.yaml`:

```yaml
KEYCLOAK_ENABLED: "true"
KEYCLOAK_URL: https://auth.your-domain.com
KEYCLOAK_REALM: home
KEYCLOAK_CLIENT_ID: haven
```

For a reverse proxy, point the public hostname at Haven's port `43127`. Add that final public URL to the Keycloak client's valid redirect URIs and web origins. The container has a `/health` endpoint, runs with a read-only filesystem, and restarts automatically.

## Keycloak setup

1. Create a public OpenID Connect client in Keycloak (no client secret) with Standard Flow and PKCE enabled.
2. Add your Haven URL to **Valid redirect URIs** (for local development: `http://localhost:4173/*`).
3. Add the origin to **Web origins** (for local development: `http://localhost:4173`).
4. Edit `config.js`, set the server URL, realm, and client ID, then set `auth.enabled` to `true`.

The browser uses Authorization Code Flow with PKCE. Integration tokens must not be stored in frontend code; the production step should add a small server-side API/session layer for Home Assistant, calendars, and Arr services.

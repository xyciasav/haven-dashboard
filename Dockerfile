FROM node:22-alpine

ARG HAVEN_VERSION=0.5.6
ENV HAVEN_VERSION=$HAVEN_VERSION

WORKDIR /app
COPY server.js /app/server.js
COPY index.html styles.css settings.css security.css version.css keycloak.css recovery.css app-manager.css integrations.css app.js manifest.webmanifest service-worker.js /opt/haven/site/
COPY icons /opt/haven/site/icons
COPY vendor /opt/haven/site/vendor
COPY docker-entrypoint.d/40-haven-config.sh /usr/local/bin/haven-entrypoint

RUN chmod +x /usr/local/bin/haven-entrypoint && addgroup -S haven && adduser -S haven -G haven && mkdir -p /app/public /app/data && chown -R haven:haven /app /opt/haven

USER haven
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/haven-entrypoint"]
CMD ["node", "/app/server.js"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

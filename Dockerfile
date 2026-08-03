FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html styles.css settings.css app.js manifest.webmanifest service-worker.js /opt/haven/site/
COPY icons /opt/haven/site/icons
COPY config.template.js /opt/haven/config.template.js
COPY docker-entrypoint.d/40-haven-config.sh /docker-entrypoint.d/40-haven-config.sh

RUN chmod +x /docker-entrypoint.d/40-haven-config.sh && rm -rf /usr/share/nginx/html/*

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1

# Apache Reverse Proxy and TLS Runbook

Date drafted: 2026-03-11
Target OS: AlmaLinux 10.1

## Scope

This runbook documents the target ingress design for both nodes:

- Primary node: `vps-3dbbfb0b.vps.ovh.ca`
- Secondary node: `vps-16535090.vps.ovh.ca`

Ingress platform:

- Apache HTTP Server
- Let's Encrypt certificates
- Host-managed reverse proxy in front of Podman-managed application containers
- Multi-domain virtual host routing for customer applications

## Status on 2026-03-14

- Apache is currently deployed from AlmaLinux packages and reports `2.4.63` on the live nodes.
- `SimpleHost Control` public-web tooling is now owned by [`/opt/simplehostman/src/packaging/httpd`](/opt/simplehostman/src/packaging/httpd) and [`/opt/simplehostman/src/scripts/control/configure-public-web.sh`](/opt/simplehostman/src/scripts/control/configure-public-web.sh).
- The primary operator hostname `vps-prd.pyrosa.com.do` currently maps:
  - `https://vps-prd.pyrosa.com.do/` to the reserved default document root `/var/www/html`
  - `https://vps-prd.pyrosa.com.do:3200/` to the SimpleHost control plane on `127.0.0.1:3200`
- The passive secondary `vps-des.pyrosa.com.do` keeps the same public operator ingress shape for smoke tests and controlled promotion.
- The Apache operator listener on `3200` stays bound to the node public IPv4 so it does not collide with the local loopback service on `127.0.0.1`.
- `httpd` must start after `network-online.target` so those public-IP listeners come up reliably on reboot.
- The combined control plane listens locally on `127.0.0.1:3200` and is exposed publicly only through Apache when operator ingress is enabled.
- As of `2026-05-02`, `code-server` is no longer exposed through
  `https://vps-prd.pyrosa.com.do:8080/` or
  `https://vps-des.pyrosa.com.do:8080/`; the canonical browser endpoint is
  `https://code.pyrosa.com.do/` on `443`, with matching vhosts on both nodes.

## Selected platform

Verified on `2026-04-29` against the official Apache HTTP Server download page, the latest Apache HTTP Server stable release is `2.4.66`.

Target platform:

- Apache HTTP Server `2.4.66`
- Let's Encrypt for certificate issuance and renewal

Reference:

- https://httpd.apache.org/download.cgi

Why Apache runs on the host:

- Simpler certificate file ownership and renewal
- Simpler early-boot service ordering
- Cleaner public ingress path
- Application containers can stay local-only

## Public exposure

Expose on both nodes:

- `80/tcp`
- `443/tcp`

Optional operator-convenience exposure, when enabled on a node:

- `3200/tcp` for the SimpleHost control plane over Apache TLS proxy

`code-server` is exposed only through the named HTTPS vhost
`https://code.pyrosa.com.do/` on `443`, while the service itself stays bound to
`127.0.0.1:8080`.

Port `80/tcp` is kept for:

- ACME challenges
- Safe redirect from HTTP to HTTPS

## Reverse proxy model

- Apache listens publicly on both nodes.
- Application containers publish only local ports to `127.0.0.1`.
- Apache proxies to those local application ports.
- Each application gets its own virtual host and log separation.

Default public traffic policy:

- Primary node serves live traffic
- Secondary node remains ready for controlled failover

After application state is externalized, both nodes may be used actively.

The per-domain naming and inventory model is documented in:

- [`/opt/simplehostman/src/docs/MULTI_DOMAIN.md`](/opt/simplehostman/src/docs/MULTI_DOMAIN.md)

Source-controlled proxy artifacts:

- [`/opt/simplehostman/src/platform/httpd/conf.d/00-global-hardening.conf`](/opt/simplehostman/src/platform/httpd/conf.d/00-global-hardening.conf)
- [`/opt/simplehostman/src/platform/httpd/conf.d/10-acme-challenge.conf`](/opt/simplehostman/src/platform/httpd/conf.d/10-acme-challenge.conf)
- [`/opt/simplehostman/src/platform/httpd/conf.d/20-proxy-defaults.conf`](/opt/simplehostman/src/platform/httpd/conf.d/20-proxy-defaults.conf)
- [`/opt/simplehostman/src/platform/httpd/vhosts/app-vhost.conf.template`](/opt/simplehostman/src/platform/httpd/vhosts/app-vhost.conf.template)
- [`/opt/simplehostman/src/platform/httpd/vhosts/redirect-vhost.conf.template`](/opt/simplehostman/src/platform/httpd/vhosts/redirect-vhost.conf.template)
- [`/opt/simplehostman/src/packaging/httpd/simplehost-control-http.conf.template`](/opt/simplehostman/src/packaging/httpd/simplehost-control-http.conf.template)
- [`/opt/simplehostman/src/packaging/httpd/simplehost-control-https.conf.template`](/opt/simplehostman/src/packaging/httpd/simplehost-control-https.conf.template)
- [`/opt/simplehostman/src/packaging/httpd/simplehost-ssl-listen.conf`](/opt/simplehostman/src/packaging/httpd/simplehost-ssl-listen.conf)
- [`/opt/simplehostman/src/scripts/control/configure-public-web.sh`](/opt/simplehostman/src/scripts/control/configure-public-web.sh)

## Recommended Apache modules

Enable only the modules needed for the front proxy role:

- `mod_ssl`
- `mod_http2`
- `mod_headers`
- `mod_rewrite`
- `mod_proxy`
- `mod_proxy_http`
- `mod_proxy_balancer` only if explicitly needed later
- `mod_remoteip` only when traffic is placed behind a trusted CDN or proxy

## TLS policy

- Redirect cleartext traffic to HTTPS
- Keep modern TLS protocols and ciphers from the supported Apache and OpenSSL baseline
- Enable HSTS only after HTTPS is confirmed stable
- Keep certificate private keys readable only by the Apache service context

## Let's Encrypt policy

Primary issuance method:

- Use host-based ACME automation

Preferred validation options:

- `HTTP-01` for simple direct issuance
- `DNS-01` later if wildcard certificates or DNS-driven automation become necessary

Even though `HTTP-01` is acceptable here, the DNS runbook keeps the option open to move certificate validation to DNS later because the platform already owns the authoritative DNS API.

Recommended local layout:

- ACME webroot: `/var/www/letsencrypt/`
- Live certificates: `/etc/letsencrypt/live/`
- Apache virtual host fragments: `/etc/httpd/conf.d/`

Renewal rule:

- Renew automatically
- Reload Apache only after successful renewal

## Backend application policy

- Proxy to `127.0.0.1:<port>` targets only
- Keep timeouts explicit
- Preserve forwarding headers consistently
- Set separate vhosts for each application
- Keep health-check endpoints simple and cache-free

Recommended forwarded headers:

- `Host`
- `X-Forwarded-For`
- `X-Forwarded-Proto`
- `X-Forwarded-Host`

## Logging

Keep logs separate for:

- Access
- Errors
- Per-application vhost traffic where required

If a CDN or external proxy is added later, only trust `mod_remoteip` for explicitly known proxy source ranges.

## Validation

Example checks:

```bash
httpd -t
apachectl -M
ss -tulpn | grep -E ':(80|443) '
curl -I http://example.com
curl -I https://example.com
```

Expected outcomes:

- Apache configuration passes validation
- Port `80` answers and redirects as intended
- Port `443` serves the expected certificate and application

## Failure handling

- If the primary node fails, redirect traffic deliberately to the secondary node.
- Do not assume DNS round-robin equals health-checked load balancing.
- Keep proxy configuration synchronized across both nodes so controlled failover is quick.

## Relationship to containers

Apache is the public entrypoint.

Application containers behind Apache are documented in:

- [`/opt/simplehostman/src/docs/CONTAINERS.md`](/opt/simplehostman/src/docs/CONTAINERS.md)

Database services behind the application layer are documented in:

- [`/opt/simplehostman/src/docs/DATABASES.md`](/opt/simplehostman/src/docs/DATABASES.md)

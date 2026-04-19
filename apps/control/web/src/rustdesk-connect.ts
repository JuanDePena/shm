import { type RustDeskPublicConnectionInfo } from "@simplehost/control-contracts";
import { escapeHtml, renderPanelShell, type PanelNotice } from "@simplehost/ui";

import { type WebLocale } from "./request.js";

function formatDate(value: string | undefined, locale: WebLocale): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale === "es" ? "es-DO" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  }).format(new Date(value));
}

export function renderRustDeskConnectPage(
  locale: WebLocale,
  connection: RustDeskPublicConnectionInfo,
  options: {
    hasSession?: boolean;
    notice?: PanelNotice;
  } = {}
): string {
  const copy =
    locale === "es"
      ? {
          title: "Conectar RustDesk",
          heading: "RustDesk Connect",
          eyebrow: "Acceso remoto SimpleHostMan",
          summary:
            "Usa estos datos para conectar clientes RustDesk a tu servidor alojado en SimpleHostMan.",
          operatorLabel: options.hasSession ? "Abrir vista operativa" : "Login de operador",
          operatorHref: options.hasSession ? "/?view=rustdesk" : "/login",
          languageLabel: "Idioma",
          languageAction: "Cambiar",
          connectionTitle: "Datos de conexión",
          connectionDescription:
            "Comparte el hostname estable y la clave pública. No necesitas exponer nombres de nodo a los usuarios ni cambiar el flujo de acceso del operador.",
          stepsTitle: "Pasos rápidos",
          stepsDescription:
            "Estos son los datos mínimos para que el cliente OSS quede configurado correctamente.",
          dnsTitle: "Referencia DNS",
          dnsDescription:
            "El TXT sirve como referencia pública para operadores o scripts; los clientes RustDesk no lo consumen automáticamente.",
          notesTitle: "Notas",
          notesDescription:
            "Mantén siempre a los clientes apuntando al hostname estable del servicio.",
          statusLabel: "Estado",
          updatedLabel: "Actualizado",
          idServerLabel: "ID Server",
          relayServerLabel: "Relay Server",
          keyLabel: "Key",
          txtFqdnLabel: "FQDN TXT",
          txtValueLabel: "Valor TXT",
          automaticLabel: "automático",
          copyLabel: "Copiar",
          copiedLabel: "Copiado",
          readyLabel: "listo",
          incompleteLabel: "incompleto",
          missingValueLabel: "Pendiente de configuración",
          stepOne: "Abre RustDesk y entra a la configuración de red o ID server.",
          stepTwo:
            "Usa este hostname como ID Server y, si prefieres explícito, también como Relay Server.",
          stepThree: "Pega esta Key pública y guarda la configuración.",
          noteOne:
            "Si mañana hay failover, los clientes siguen igual mientras el hostname y la key no cambien.",
          noteTwo:
            "La key publicada aquí es pública por diseño. La clave privada nunca debe exponerse.",
          incompleteNotice:
            "La publicación pública de RustDesk aún no está completa. Verifica hostname y clave en la vista operativa."
        }
      : {
          title: "RustDesk Connect",
          heading: "RustDesk Connect",
          eyebrow: "SimpleHostMan remote access",
          summary:
            "Use these values to connect RustDesk clients to your self-hosted SimpleHostMan server.",
          operatorLabel: options.hasSession ? "Open operator view" : "Operator login",
          operatorHref: options.hasSession ? "/?view=rustdesk" : "/login",
          languageLabel: "Language",
          languageAction: "Switch",
          connectionTitle: "Connection details",
          connectionDescription:
            "Share the stable hostname and public key. Users do not need node-specific hostnames or a separate operator flow.",
          stepsTitle: "Quick steps",
          stepsDescription:
            "These are the minimum values needed to configure the OSS client correctly.",
          dnsTitle: "DNS reference",
          dnsDescription:
            "The TXT record is a public reference for operators or scripts; RustDesk clients do not auto-consume it.",
          notesTitle: "Notes",
          notesDescription:
            "Keep clients pinned to the stable service hostname at all times.",
          statusLabel: "Status",
          updatedLabel: "Updated",
          idServerLabel: "ID Server",
          relayServerLabel: "Relay Server",
          keyLabel: "Key",
          txtFqdnLabel: "TXT FQDN",
          txtValueLabel: "TXT value",
          automaticLabel: "automatic",
          copyLabel: "Copy",
          copiedLabel: "Copied",
          readyLabel: "ready",
          incompleteLabel: "incomplete",
          missingValueLabel: "Still being configured",
          stepOne: "Open RustDesk and go to the network or ID server settings.",
          stepTwo:
            "Use this hostname as the ID Server and, if you want it explicit, also as the Relay Server.",
          stepThree: "Paste this public Key and save the configuration.",
          noteOne:
            "If failover happens later, clients keep working as long as the hostname and key stay the same.",
          noteTwo:
            "The key shown here is public by design. The private key must never be exposed.",
          incompleteNotice:
            "RustDesk public publishing is not complete yet. Verify hostname and key in the operator workspace."
        };

  const renderCopyRow = (label: string, value: string | undefined): string => {
    const resolvedValue = value?.trim() ? value.trim() : undefined;

    return `<div class="copy-row">
      <div class="copy-meta">
        <span class="copy-label">${escapeHtml(label)}</span>
        <code class="copy-value">${escapeHtml(resolvedValue ?? copy.missingValueLabel)}</code>
      </div>
      <button
        type="button"
        class="secondary"
        data-copy-value="${escapeHtml(resolvedValue ?? "")}"
        data-copy-label="${escapeHtml(copy.copyLabel)}"
        data-copy-success="${escapeHtml(copy.copiedLabel)}"
        ${resolvedValue ? "" : "disabled"}
      >${escapeHtml(copy.copyLabel)}</button>
    </div>`;
  };

  const renderConnectBadge = (
    label: string,
    value: string,
    tone: "success" | "danger" | "muted" = "muted"
  ): string => `<div class="connect-meta-badge connect-meta-badge-${tone}">
      <span class="connect-meta-badge-label">${escapeHtml(label)}</span>
      <strong class="connect-meta-badge-value">${escapeHtml(value)}</strong>
    </div>`;

  const heroActions = `<div class="connect-hero-actions">
      <div class="locale-switch" role="group" aria-label="${escapeHtml(copy.languageLabel)}">
        <form method="post" action="/preferences/locale" class="inline-form">
          <input type="hidden" name="returnTo" value="/connect/rustdesk" />
          <input type="hidden" name="locale" value="es" />
          <button
            type="submit"
            class="locale-button${locale === "es" ? " active" : ""}"
            aria-pressed="${locale === "es" ? "true" : "false"}"
          >ES</button>
        </form>
        <form method="post" action="/preferences/locale" class="inline-form">
          <input type="hidden" name="returnTo" value="/connect/rustdesk" />
          <input type="hidden" name="locale" value="en" />
          <button
            type="submit"
            class="locale-button${locale === "en" ? " active" : ""}"
            aria-pressed="${locale === "en" ? "true" : "false"}"
          >EN</button>
        </form>
      </div>
      <a class="button-link" href="${escapeHtml(copy.operatorHref)}">${escapeHtml(
        copy.operatorLabel
      )}</a>
    </div>`;
  const statusTone = connection.status === "ready" ? "success" : "danger";
  const updatedLabel = formatDate(connection.generatedAt, locale);
  const notice =
    options.notice ??
    (connection.status === "incomplete"
      ? ({
          kind: "info",
          message: copy.incompleteNotice
        } satisfies PanelNotice)
      : undefined);

  return renderPanelShell({
    lang: locale,
    title: copy.title,
    heading: copy.heading,
    actions: heroActions,
    notice,
    pageClassName: "page-connect",
    body: `<style>
        .page.page-connect {
          margin: 0 auto 0.18rem;
          padding-top: 0.42rem;
        }

        .page-connect {
          display: grid;
          align-content: start;
          min-height: calc(100vh - 0.6rem);
          margin-bottom: 0;
        }

        .connect-shell {
          margin-top: 0.36rem;
        }

        .connect-hero-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: center;
          gap: 0.28rem;
        }

        .connect-hero-actions .locale-switch {
          display: inline-flex;
          align-items: center;
          gap: 0.16rem;
          padding: 0.12rem;
          border: 1px solid rgba(13, 32, 56, 0.08);
          border-radius: var(--radius-control);
          background: rgba(255, 255, 255, 0.9);
        }

        .connect-hero-actions .inline-form {
          margin: 0;
        }

        .connect-hero-actions .locale-button {
          min-width: 2.95rem;
          min-height: 1.72rem;
          padding: 0.24rem 0.5rem;
          border-radius: var(--radius-control);
          background: transparent;
          color: var(--navy-strong);
          box-shadow: none;
          border: 1px solid rgba(13, 32, 56, 0.08);
        }

        .connect-hero-actions .locale-button:hover,
        .connect-hero-actions .locale-button:focus-visible {
          background: rgba(16, 39, 68, 0.08);
        }

        .connect-hero-actions .locale-button.active {
          background: linear-gradient(135deg, var(--navy-soft), var(--navy-strong));
          color: #f5fbff;
          box-shadow: none;
          border-color: rgba(13, 32, 56, 0.16);
        }

        .connect-layout {
          grid-template-columns: minmax(0, 1.18fr) minmax(20rem, 0.9fr);
          align-items: start;
        }

        .connect-main-stack,
        .connect-side-stack {
          display: grid;
          gap: 0.62rem;
        }

        .connect-lead {
          margin: 0;
          font-size: 0.88rem;
          color: var(--muted);
        }

        .connect-meta-strip {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }

        .connect-meta-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.34rem;
          max-width: 100%;
          padding: 0.24rem 0.38rem;
          border-radius: 999px;
          background: rgba(13, 32, 56, 0.08);
        }

        .connect-meta-badge-success {
          background: var(--attention-soft);
        }

        .connect-meta-badge-danger {
          background: var(--danger-soft);
        }

        .connect-meta-badge-label {
          font-size: 0.68rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
        }

        .connect-meta-badge-value {
          color: var(--navy-deep);
          font-size: 0.84rem;
          font-weight: 700;
        }

        .connect-meta-badge-success .connect-meta-badge-value {
          color: #557d16;
        }

        .connect-meta-badge-danger .connect-meta-badge-value {
          color: var(--danger);
        }

        .copy-stack {
          display: grid;
          gap: 0.62rem;
        }

        .copy-row {
          display: flex;
          gap: 0.62rem;
          align-items: center;
          justify-content: space-between;
          padding: 0.58rem 0.68rem;
          border-radius: 0.76rem;
          border: 1px solid var(--line);
          background: rgba(255, 255, 255, 0.72);
        }

        .copy-meta {
          display: grid;
          gap: 0.18rem;
          min-width: 0;
        }

        .copy-label {
          font-size: 0.7rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
        }

        .copy-value {
          display: block;
          overflow-wrap: anywhere;
          color: var(--navy-deep);
          font-size: 0.86rem;
        }

        .connect-notes,
        .connect-steps {
          margin: 0;
          padding-left: 2rem;
          color: var(--ink);
        }

        .connect-steps li,
        .connect-notes li {
          margin: 0.04rem 0;
        }

        @media (max-width: 900px) {
          .page-connect {
            min-height: auto;
          }

          .connect-layout {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        @media (max-width: 720px) {
          .connect-hero-actions {
            justify-content: flex-start;
          }

          .connect-hero-actions .locale-switch {
            width: 100%;
            justify-content: flex-start;
          }

          .copy-row {
            flex-direction: column;
            align-items: stretch;
          }
        }
      </style>
      <section class="stack connect-shell">
        <section class="grid connect-layout">
          <div class="connect-main-stack">
            <article class="panel detail-shell">
              <div class="section-head">
                <div>
                  <h2>${escapeHtml(copy.connectionTitle)}</h2>
                  <p class="muted section-description">${escapeHtml(copy.summary)}</p>
                </div>
              </div>
              <p class="connect-lead">${escapeHtml(copy.connectionDescription)}</p>
              <div class="connect-meta-strip">
                ${renderConnectBadge(
                  copy.statusLabel,
                  connection.status === "ready" ? copy.readyLabel : copy.incompleteLabel,
                  statusTone
                )}
                ${renderConnectBadge(copy.updatedLabel, updatedLabel)}
              </div>
              <div class="copy-stack">
                ${renderCopyRow(copy.idServerLabel, connection.publicHostname)}
                ${renderCopyRow(copy.relayServerLabel, connection.relayHostname)}
                ${renderCopyRow(copy.keyLabel, connection.publicKey)}
              </div>
            </article>
            <article class="panel detail-shell">
              <div class="section-head">
                <div>
                  <h2>${escapeHtml(copy.notesTitle)}</h2>
                  <p class="muted section-description">${escapeHtml(copy.notesDescription)}</p>
                </div>
              </div>
              <ul class="connect-notes">
                <li>${escapeHtml(copy.noteOne)}</li>
                <li>${escapeHtml(copy.noteTwo)}</li>
              </ul>
            </article>
          </div>
          <div class="connect-side-stack">
            <article class="panel detail-shell">
              <div class="section-head">
                <div>
                  <h2>${escapeHtml(copy.stepsTitle)}</h2>
                  <p class="muted section-description">${escapeHtml(copy.stepsDescription)}</p>
                </div>
              </div>
              <ol class="connect-steps">
                <li>${escapeHtml(copy.stepOne)}</li>
                <li>${escapeHtml(copy.stepTwo)}</li>
                <li>${escapeHtml(copy.stepThree)}</li>
              </ol>
            </article>
            <article class="panel detail-shell">
              <div class="section-head">
                <div>
                  <h2>${escapeHtml(copy.dnsTitle)}</h2>
                  <p class="muted section-description">${escapeHtml(copy.dnsDescription)}</p>
                </div>
              </div>
              <div class="copy-stack">
                ${renderCopyRow(copy.txtFqdnLabel, connection.txtRecordFqdn)}
                ${renderCopyRow(copy.txtValueLabel, connection.txtRecordValue)}
              </div>
            </article>
          </div>
        </section>
      </section>
      <script>
        (() => {
          const copyButtons = document.querySelectorAll('[data-copy-value]');
          const fallbackCopy = (value) => {
            const input = document.createElement('textarea');
            input.value = value;
            input.setAttribute('readonly', 'true');
            input.style.position = 'absolute';
            input.style.left = '-9999px';
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
          };

          copyButtons.forEach((button) => {
            button.addEventListener('click', async () => {
              const value = button.getAttribute('data-copy-value') || '';
              const idleLabel = button.getAttribute('data-copy-label') || 'Copy';
              const successLabel = button.getAttribute('data-copy-success') || 'Copied';

              if (!value) {
                return;
              }

              try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  await navigator.clipboard.writeText(value);
                } else {
                  fallbackCopy(value);
                }

                const previous = button.textContent;
                button.textContent = successLabel;
                window.setTimeout(() => {
                  button.textContent = previous || idleLabel;
                }, 1600);
              } catch {
                fallbackCopy(value);
                button.textContent = successLabel;
                window.setTimeout(() => {
                  button.textContent = idleLabel;
                }, 1600);
              }
            });
          });
        })();
      </script>`
  });
}

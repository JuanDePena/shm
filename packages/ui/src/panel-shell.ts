import { renderBaseStyleBlock } from "./base-styles.js";
import { escapeHtml, renderNotice } from "./html.js";
import { renderPanelShellStyleBlock } from "./panel-shell-styles.js";
import type { PanelShellProps } from "./ui-types.js";

export function renderPanelShell(props: PanelShellProps): string {
  const noticeHtml = renderNotice(props.notice);
  const actionsHtml = props.actions ? `<div class="hero-actions">${props.actions}</div>` : "";
  const eyebrowHtml =
    props.eyebrow !== undefined
      ? `<p class="hero-eyebrow">${escapeHtml(props.eyebrow)}</p>`
      : "";
  const subheadingHtml = props.subheading
    ? `<p class="hero-subheading">${escapeHtml(props.subheading)}</p>`
    : "";
  const pageClassName = ["page", props.pageClassName].filter(Boolean).join(" ");
  const heroClassName = [
    "hero",
    props.heroAlign === "center" ? "hero-center" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return `<!doctype html>
<html lang="${escapeHtml(props.lang ?? "en")}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(props.title)}</title>
    <style>
${renderBaseStyleBlock()}
${renderPanelShellStyleBlock()}
    </style>
  </head>
  <body>
    <main class="${escapeHtml(pageClassName)}">
      <header class="${escapeHtml(heroClassName)}">
        <div class="hero-row">
          <div class="hero-copy">
            ${eyebrowHtml}
            <h1>${escapeHtml(props.heading)}</h1>
            ${subheadingHtml}
          </div>
          ${actionsHtml}
        </div>
        ${noticeHtml}
      </header>
      ${props.body}
    </main>
  </body>
</html>`;
}

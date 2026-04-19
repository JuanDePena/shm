import { renderAdminShellStyleBlock } from "./admin-shell-styles.js";
import { renderBaseStyleBlock } from "./base-styles.js";
import { renderAdminShellClientScript } from "./client-behaviors.js";
import { escapeHtml, renderNotice } from "./html.js";
import type { AdminShellProps } from "./ui-types.js";

export function renderAdminShell(props: AdminShellProps): string {
  const noticeHtml = renderNotice(props.notice);
  const sidebarGroupsHtml = props.sidebarGroups
    .map((group) => {
      const itemsHtml = group.items
        .map(
          (item) => `<a
            href="${escapeHtml(item.href)}"
            class="sidebar-link${item.active ? " active" : ""}"
            data-nav-item
            data-search="${escapeHtml(
              `${item.label} ${(item.keywords ?? []).join(" ")}`.toLowerCase()
            )}"
          >
            <span>${escapeHtml(item.label)}</span>
            ${
              item.badge
                ? `<span class="sidebar-badge${item.badge === "0" ? " sidebar-badge-zero" : ""}">${escapeHtml(item.badge)}</span>`
                : ""
            }
          </a>`
        )
        .join("");

      return `<section class="sidebar-group" data-nav-group>
        <p class="sidebar-group-label">${escapeHtml(group.label)}</p>
        <div class="sidebar-links">${itemsHtml}</div>
      </section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="${escapeHtml(props.lang ?? "en")}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(props.title)}</title>
    <style>
${renderBaseStyleBlock()}
${renderAdminShellStyleBlock()}
    </style>
  </head>
  <body>
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <div class="sidebar-header">
          <div class="sidebar-brand">
            <strong class="sidebar-brand-title">${escapeHtml(props.appName)}</strong>
          </div>
          <label class="sidebar-search">
            <span class="sr-only">${escapeHtml(props.sidebarSearchPlaceholder)}</span>
            <input type="search" placeholder="${escapeHtml(props.sidebarSearchPlaceholder)}" data-sidebar-search />
          </label>
        </div>
        <div class="sidebar-body">
          <nav class="sidebar-nav">
            ${sidebarGroupsHtml}
          </nav>
        </div>
        <footer class="sidebar-footer">
          <span>${escapeHtml(props.versionLabel)}</span>
          <strong>${escapeHtml(props.versionValue)}</strong>
        </footer>
      </aside>
      <div class="admin-main">
        <section class="page-header">
          <div class="page-header-row">
            <div class="page-header-copy">
              <h1>${escapeHtml(props.heading)}</h1>
              ${
                props.subheading
                  ? `<p class="muted">${escapeHtml(props.subheading)}</p>`
                  : ""
              }
            </div>
            ${
              props.headerActionsHtml
                ? `<div class="page-header-actions">${props.headerActionsHtml}</div>`
              : ""
            }
          </div>
        </section>
        <section class="page-body-card">
          <div class="page-body-scroll">
            ${noticeHtml}
            ${props.body}
          </div>
        </section>
      </div>
    </div>
    <script>
      ${renderAdminShellClientScript()}
    </script>
  </body>
</html>`;
}

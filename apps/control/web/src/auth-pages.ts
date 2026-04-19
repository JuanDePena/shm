import {
  escapeHtml,
  renderPanelShell,
  type PanelNotice
} from "@simplehost/ui";

import { type WebLocale } from "./request.js";
import { copyByLocale } from "./web-copy.js";

export function renderLoginPage(locale: WebLocale, notice?: PanelNotice): string {
  const copy = copyByLocale[locale];

  return renderPanelShell({
    lang: locale,
    title: copy.loginTitle,
    heading: copy.appName,
    subheading: copy.loginDescription,
    notice,
    pageClassName: "page-login",
    heroAlign: "center",
    body: `<section class="grid login-shell">
      <article class="panel login-card">
        <div class="login-card-header">
          <h2>${escapeHtml(copy.loginAccess)}</h2>
          <p>${escapeHtml(copy.loginAccessDescription)}</p>
        </div>
        <form method="post" action="/auth/login" class="stack">
          <label>${escapeHtml(copy.emailLabel)}
            <input type="email" name="email" autocomplete="username" required />
          </label>
          <label>${escapeHtml(copy.passwordLabel)}
            <input type="password" name="password" autocomplete="current-password" required />
          </label>
          <button type="submit">${escapeHtml(copy.signInLabel)}</button>
        </form>
      </article>
    </section>`
  });
}

export function renderAdminShellStyleBlock(): string {
  return `
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      .admin-shell {
        display: grid;
        grid-template-columns: minmax(12.8rem, 14.35rem) minmax(0, 1fr);
        gap: 0.66rem;
        height: 100vh;
        min-height: 100vh;
        padding: 0.66rem;
        overflow: hidden;
      }

      .admin-sidebar {
        position: sticky;
        top: 0.66rem;
        align-self: start;
        height: calc(100vh - 1.32rem);
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.62rem 0.58rem 0.58rem;
        border: 1px solid rgba(183, 243, 77, 0.16);
        border-radius: var(--radius-card);
        background:
          linear-gradient(180deg, rgba(10, 23, 48, 0.96), rgba(16, 39, 68, 0.94)),
          radial-gradient(circle at top left, rgba(183, 243, 77, 0.1), transparent 14rem);
        color: #eff7ff;
        box-shadow: 0 1.6rem 3.8rem rgba(7, 17, 34, 0.28);
        overflow: hidden;
      }

      .sidebar-header {
        display: grid;
        gap: 0.44rem;
        padding-bottom: 0.52rem;
        border-bottom: 1px solid rgba(239, 247, 255, 0.08);
      }

      .sidebar-brand {
        display: grid;
        gap: 0.2rem;
      }

      .sidebar-eyebrow {
        margin: 0;
        color: rgba(239, 247, 255, 0.72);
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 0.74rem;
      }

      .sidebar-brand-title {
        display: block;
        font-size: var(--font-size-sidebar-title);
        line-height: 1;
        font-weight: 700;
      }

      .sidebar-search {
        display: block;
        margin-top: 0.24rem;
        margin-bottom: 0.26rem;
      }

      .sidebar-search input {
        border-color: rgba(10, 23, 48, 0.22);
        background: rgba(236, 255, 192, 0.94);
        color: rgba(10, 23, 48, 0.96);
        caret-color: rgba(10, 23, 48, 0.96);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
      }

      .sidebar-search input::placeholder {
        color: rgba(10, 23, 48, 0.76);
      }

      .sidebar-search input:focus,
      .sidebar-search input:focus-visible {
        border-color: rgba(10, 23, 48, 0.34);
        background: rgba(244, 255, 214, 1);
        box-shadow:
          inset 0 0 0 1px rgba(255, 255, 255, 0.22),
          0 0 0 0.16rem rgba(183, 243, 77, 0.22);
      }

      .sidebar-body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        display: grid;
        align-content: start;
        gap: 0.58rem;
        padding-right: 0.08rem;
        scrollbar-gutter: stable;
        scrollbar-width: thin;
        scrollbar-color: rgba(183, 243, 77, 0.28) rgba(255, 255, 255, 0.03);
      }

      .sidebar-body::-webkit-scrollbar {
        width: 0.42rem;
      }

      .sidebar-body::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.03);
        border-radius: 999px;
      }

      .sidebar-body::-webkit-scrollbar-thumb {
        background: rgba(183, 243, 77, 0.26);
        border-radius: 999px;
      }

      .sidebar-body::-webkit-scrollbar-thumb:hover {
        background: rgba(183, 243, 77, 0.4);
      }

      .sidebar-nav {
        display: grid;
        gap: 0.58rem;
      }

      .sidebar-group {
        display: grid;
        gap: 0.28rem;
      }

      .sidebar-group + .sidebar-group {
        margin-top: 0.18rem;
      }

      .sidebar-group-label {
        margin: 0.08rem 0 0;
        color: rgba(183, 243, 77, 0.82);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.69rem;
      }

      .sidebar-links {
        display: grid;
        gap: 0.14rem;
      }

      .sidebar-link {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.44rem;
        min-height: 2.2rem;
        padding: 0.32rem 0.52rem;
        border-radius: 0.58rem;
        color: #eff7ff;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid transparent;
        line-height: 1.1;
      }

      .sidebar-link > span:first-child {
        min-width: 0;
      }

      .sidebar-link:hover,
      .sidebar-link:focus-visible {
        text-decoration: none;
        border-color: rgba(183, 243, 77, 0.18);
        background: rgba(183, 243, 77, 0.08);
      }

      .sidebar-link.active {
        border-color: rgba(183, 243, 77, 0.24);
        background:
          linear-gradient(135deg, rgba(183, 243, 77, 0.2), rgba(242, 140, 40, 0.18)),
          rgba(255, 255, 255, 0.08);
        color: #ffffff;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
      }

      .sidebar-link.active .sidebar-badge {
        background: rgba(10, 23, 48, 0.36);
        color: #ffffff;
      }

      .sidebar-badge {
        padding: 0.12rem 0.36rem;
        border-radius: 999px;
        background: rgba(242, 140, 40, 0.22);
        color: #ffd9ae;
        font-size: 0.7rem;
      }

      .sidebar-badge-zero {
        background: rgba(239, 247, 255, 0.08);
        color: rgba(239, 247, 255, 0.62);
      }

      .sidebar-footer {
        flex-shrink: 0;
        padding-top: 0.48rem;
        border-top: 1px solid rgba(239, 247, 255, 0.08);
        color: rgba(239, 247, 255, 0.74);
        font-size: var(--font-size-meta);
      }

      .sidebar-footer strong {
        display: block;
        color: #ffffff;
      }

      .admin-main {
        min-width: 0;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        gap: 0.7rem;
        min-height: 0;
        height: calc(100vh - 1.32rem);
        overflow: hidden;
      }

      .page-body-card {
        min-height: 0;
        display: grid;
        overflow: hidden;
        border: 1px solid rgba(13, 32, 56, 0.08);
        border-radius: var(--radius-hero);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(246, 249, 253, 0.74)),
          linear-gradient(135deg, rgba(13, 32, 56, 0.03), rgba(0, 127, 255, 0.035) 60%, rgba(255, 255, 255, 0.08));
        backdrop-filter: blur(10px);
      }

      .page-body-scroll {
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        display: grid;
        align-content: start;
        gap: 0.7rem;
        padding: 0.74rem;
        scrollbar-gutter: stable;
      }

      .page-header-actions {
        display: flex;
        flex-wrap: nowrap;
        align-items: center;
        gap: 0.22rem;
        margin-left: auto;
        color: var(--ink);
      }

      .page-header-actions form,
      .page-header-actions label {
        margin: 0;
      }

      .locale-switch {
        display: inline-flex;
        align-items: center;
        gap: 0.16rem;
        padding: 0.12rem;
        border: 1px solid rgba(13, 32, 56, 0.12);
        border-radius: var(--radius-control);
        background: rgba(255, 255, 255, 0.82);
        box-shadow: 0 0.5rem 1.4rem rgba(16, 39, 68, 0.08);
      }

      .locale-switch form {
        margin: 0;
      }

      .locale-button {
        min-width: 2.95rem;
        min-height: 1.72rem;
        padding: 0.24rem 0.5rem;
        border-radius: var(--radius-control);
        background: transparent;
        color: var(--navy-strong);
        box-shadow: none;
      }

      .locale-button:hover,
      .locale-button:focus-visible {
        background: rgba(16, 39, 68, 0.08);
      }

      .locale-button.active {
        background: linear-gradient(135deg, var(--navy-soft), var(--navy-strong));
        color: #f5fbff;
        box-shadow: 0 0.6rem 1.4rem rgba(16, 39, 68, 0.16);
      }

      .topbar-disclosure {
        position: relative;
      }

      .icon-button {
        width: 1.8rem;
        min-width: 1.8rem;
        height: 1.8rem;
        padding: 0;
        border-radius: var(--radius-control);
      }

      .icon-button svg {
        width: 1rem;
        height: 1rem;
        display: block;
      }

      .icon-button.secondary {
        background: rgba(16, 39, 68, 0.08);
        color: var(--navy-strong);
        border: 1px solid rgba(13, 32, 56, 0.12);
        box-shadow: none;
      }

      .icon-button.secondary:hover,
      .icon-button.secondary:focus-visible {
        background: rgba(16, 39, 68, 0.14);
      }

      .topbar-panel {
        position: absolute;
        top: calc(100% + 0.55rem);
        right: 0;
        z-index: 20;
        width: min(28rem, calc(100vw - 2.4rem));
        padding: 0.7rem;
        border: 1px solid rgba(13, 32, 56, 0.12);
        border-radius: var(--radius-panel);
        background: rgba(255, 255, 255, 0.97);
        box-shadow: 0 1.3rem 3rem rgba(16, 39, 68, 0.16);
      }

      .profile-sheet {
        display: grid;
        gap: 0.6rem;
      }

      .profile-sheet-head {
        display: flex;
        align-items: center;
        gap: 0.6rem;
      }

      .profile-sheet-copy {
        display: grid;
        gap: 0.15rem;
      }

      .profile-sheet-footer {
        padding-top: 0.2rem;
        border-top: 1px solid rgba(13, 32, 56, 0.08);
      }

      .profile-sheet-footer form {
        margin: 0;
      }

      .profile-sheet-signout {
        width: 100%;
        justify-content: center;
        gap: 0.4rem;
        min-height: var(--control-height);
      }

      .profile-sheet-signout svg {
        width: 1rem;
        height: 1rem;
      }

      .profile-card {
        display: flex;
        align-items: center;
        gap: 0.65rem;
      }

      .profile-avatar {
        width: 2.35rem;
        height: 2.35rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        background: linear-gradient(135deg, var(--navy-strong), var(--navy-soft));
        color: #f6fbff;
        font-weight: 700;
        letter-spacing: 0.08em;
        box-shadow: 0 0.8rem 1.8rem rgba(16, 39, 68, 0.18);
      }

      .profile-copy {
        display: grid;
        gap: 0.08rem;
      }

      .profile-kicker {
        color: var(--muted);
        font-size: var(--font-size-kicker);
        text-transform: uppercase;
        letter-spacing: 0.14em;
      }

      .profile-name {
        font-size: 0.92rem;
      }

      .profile-meta {
        color: var(--muted);
      }

      .profile-facts {
        display: grid;
        grid-template-columns: 13rem minmax(0, 1fr);
        gap: 0.35rem 0.7rem;
        margin: 0;
        align-items: start;
      }

      .profile-facts dt {
        margin: 0;
        color: var(--muted);
        font-size: var(--font-size-kicker);
        text-transform: uppercase;
        letter-spacing: 0.14em;
      }

      .profile-facts dd {
        margin: 0;
        color: var(--ink);
        font-weight: 600;
        word-break: break-word;
      }

      .page-header {
        display: grid;
        gap: 0.25rem;
        padding: 0.92rem 1rem;
        border: 1px solid rgba(13, 32, 56, 0.08);
        border-radius: var(--radius-hero);
        position: sticky;
        top: 0;
        z-index: 12;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.985), rgba(245, 248, 252, 0.97)),
          linear-gradient(135deg, rgba(13, 32, 56, 0.04), rgba(0, 127, 255, 0.045) 58%, rgba(255, 255, 255, 0.08));
        box-shadow: none;
      }

      .page-header-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 0.65rem;
      }

      .page-header-copy {
        display: grid;
        gap: 0.22rem;
        min-width: 0;
      }

      .page-header p {
        margin: 0;
        color: var(--text-subtle);
      }

      .page-eyebrow {
        color: var(--navy-soft);
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: var(--font-size-kicker);
      }

      .page-header h1 {
        margin: 0;
        font-size: var(--font-size-page-title);
      }

      .section-panel {
        scroll-margin-top: 2rem;
        display: grid;
        gap: 0.72rem;
        align-content: start;
      }

      .section-panel > .section-head {
        margin-bottom: 0;
      }

      .section-panel > .signal-strip + * {
        margin-top: -0.12rem;
      }

      .section-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 0.55rem;
        margin-bottom: 0.18rem;
      }

      .section-head > div {
        display: grid;
        gap: 0.02rem;
        min-width: 0;
      }

      .section-head-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        align-items: center;
        gap: 0.42rem;
      }

      .section-head-actions .toolbar,
      .section-head-actions form,
      .section-head-actions .inline-form {
        margin: 0;
      }

      .section-head-actions .header-create-action {
        min-width: 5.2rem;
      }

      .panel > .section-head {
        margin: calc(var(--space-panel) * -1) calc(var(--space-panel) * -1) 0.72rem;
        padding: 0.72rem 0.84rem;
        border-bottom: 1px solid rgba(13, 32, 56, 0.08);
        border-radius: 5px 5px 0 0;
        background:
          linear-gradient(180deg, rgba(231, 236, 242, 0.94), rgba(245, 247, 250, 0.94)),
          linear-gradient(145deg, rgba(16, 39, 68, 0.03), rgba(13, 32, 56, 0.04));
      }

      .danger-shell > .section-head {
        border-bottom-color: rgba(212, 68, 47, 0.12);
        background:
          linear-gradient(180deg, rgba(239, 231, 229, 0.96), rgba(249, 243, 241, 0.94)),
          linear-gradient(145deg, rgba(212, 68, 47, 0.03), rgba(255, 255, 255, 0.9));
      }

      .panel-nested > .section-head {
        margin: calc(var(--space-panel-tight) * -1) calc(var(--space-panel-tight) * -1) 0.62rem;
        padding: 0.62rem 0.72rem;
        border-bottom: 1px solid rgba(13, 32, 56, 0.08);
        border-radius: 5px 5px 0 0;
        background:
          linear-gradient(180deg, rgba(231, 236, 242, 0.94), rgba(245, 247, 250, 0.94)),
          linear-gradient(145deg, rgba(16, 39, 68, 0.03), rgba(13, 32, 56, 0.04));
      }

      .danger-shell.panel-nested > .section-head {
        border-bottom-color: rgba(212, 68, 47, 0.12);
        background:
          linear-gradient(180deg, rgba(239, 231, 229, 0.96), rgba(249, 243, 241, 0.94)),
          linear-gradient(145deg, rgba(212, 68, 47, 0.03), rgba(255, 255, 255, 0.9));
      }

      .proxy-workspace-panel,
      .resource-workspace-panel {
        gap: 0.08rem;
      }

      .proxy-workspace-panel > .section-head,
      .resource-workspace-panel > .section-head {
        margin-bottom: 0.42rem;
      }

      .proxy-workspace-columns,
      .resource-workspace-columns {
        display: grid;
        gap: 0.66rem;
      }

      .proxy-workspace-column,
      .resource-workspace-column {
        min-width: 0;
      }

      .proxy-actions-toolbar,
      .resource-actions-toolbar {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.55rem;
      }

      .proxy-actions-toolbar > *,
      .resource-actions-toolbar > * {
        min-width: 0;
        width: 100%;
      }

      .proxy-actions-toolbar .inline-form,
      .resource-actions-toolbar .inline-form {
        display: flex;
        width: 100%;
      }

      .proxy-actions-toolbar .inline-form > button,
      .proxy-actions-toolbar .button-link,
      .resource-actions-toolbar .inline-form > button,
      .resource-actions-toolbar .button-link {
        width: 100%;
      }

      .section-description {
        margin: 0.03rem 0 0;
        line-height: 1.45;
        font-size: 0.86rem;
      }

      .section-title-row {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
      }

      .section-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1.62rem;
        height: 1.62rem;
        padding: 0 0.48rem;
        border-radius: 999px;
        background: rgba(16, 39, 68, 0.08);
        color: var(--navy-strong);
        font-size: 0.84rem;
        font-weight: 700;
        box-shadow: inset 0 0 0 1px rgba(16, 39, 68, 0.2);
      }

      .section-badge-lime {
        background: linear-gradient(180deg, rgba(183, 243, 77, 0.36), rgba(214, 248, 157, 0.72));
        color: var(--navy-deep);
        box-shadow: inset 0 0 0 1px rgba(16, 39, 68, 0.28);
      }

      .action-grid {
        display: grid;
        gap: 0.7rem;
        margin-top: 0.65rem;
        grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
      }

      .action-card {
        display: grid;
        gap: 0.55rem;
        padding: 0.72rem;
        border-radius: var(--radius-card);
        border: 1px solid rgba(13, 32, 56, 0.1);
        background:
          linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(238, 244, 251, 0.92)),
          linear-gradient(145deg, rgba(16, 39, 68, 0.05), rgba(183, 243, 77, 0.05));
      }

      .action-card h3,
      .action-card p {
        margin: 0;
      }

      .action-card form {
        display: grid;
        gap: 0.55rem;
      }

      .action-card-context {
        display: grid;
        gap: 0.35rem;
        padding: 0.58rem 0.68rem;
        border-radius: var(--radius-card);
        border: 1px solid rgba(13, 32, 56, 0.1);
        background: rgba(255, 255, 255, 0.72);
      }

      .action-card-context-title {
        color: var(--muted);
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.16em;
      }

      .action-card-context p {
        margin: 0;
      }

      .action-card-facts {
        margin: 0;
        display: grid;
        gap: 0.28rem;
      }

      .action-card-facts-row {
        display: grid;
        grid-template-columns: minmax(0, 8.25rem) minmax(0, 1fr);
        gap: 0.52rem;
        align-items: baseline;
      }

      .action-card-facts-wide-labels .action-card-facts-row {
        grid-template-columns: minmax(0, 14rem) minmax(0, 1fr);
      }

      .action-card-facts dt {
        margin: 0;
        color: var(--muted);
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.14em;
      }

      .action-card-facts dd {
        margin: 0;
        color: var(--ink);
        font-weight: 600;
        font-size: 0.9rem;
      }

      .action-card-strong {
        background:
          linear-gradient(145deg, rgba(16, 39, 68, 0.98), rgba(24, 54, 91, 0.94)),
          radial-gradient(circle at top left, rgba(183, 243, 77, 0.14), transparent 12rem);
        color: #f6fbff;
      }

      .action-card-strong .muted {
        color: rgba(246, 251, 255, 0.74);
      }

      .action-card-strong .action-card-context {
        background: rgba(7, 16, 33, 0.24);
        border-color: rgba(255, 255, 255, 0.12);
      }

      .action-card-strong .action-card-context-title,
      .action-card-strong .action-card-facts dt {
        color: rgba(246, 251, 255, 0.62);
      }

      .action-card-strong .action-card-facts dd {
        color: #f6fbff;
      }

      .action-card-strong .action-card-context .muted {
        color: rgba(246, 251, 255, 0.74);
      }

      .action-card-accent {
        background:
          linear-gradient(145deg, rgba(242, 140, 40, 0.16), rgba(255, 255, 255, 0.96)),
          linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(250, 241, 229, 0.92));
      }

      .action-card-muted {
        background:
          linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(233, 241, 250, 0.9)),
          linear-gradient(135deg, rgba(16, 39, 68, 0.04), rgba(255, 255, 255, 0.98));
        border-style: dashed;
      }

      .action-card-note {
        margin: 0;
        color: var(--muted);
        font-size: 0.79rem;
      }

      .action-eyebrow {
        color: var(--muted);
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.16em;
      }

      .tabs {
        display: grid;
        gap: 0.62rem;
      }

      .tab-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
      }

      .tab-button {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        background: rgba(16, 39, 68, 0.08);
        color: var(--navy-soft);
        box-shadow: none;
        border: 1px solid transparent;
      }

      .tab-button.active {
        background: linear-gradient(135deg, rgba(16, 39, 68, 0.98), rgba(24, 54, 91, 0.96));
        color: #f6fbff;
        border-color: rgba(183, 243, 77, 0.18);
      }

      .tab-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1.28rem;
        height: 1.28rem;
        padding: 0 0.3rem;
        border-radius: 999px;
        background: rgba(242, 140, 40, 0.22);
        color: var(--accent);
        font-size: 0.7rem;
        font-weight: 700;
      }

      .tab-button.active .tab-badge {
        background: rgba(255, 255, 255, 0.14);
        color: #ffffff;
      }

      .tab-badge-zero {
        background: rgba(13, 32, 56, 0.08);
        color: var(--muted);
      }

      .tab-button.active .tab-badge-zero {
        background: rgba(255, 255, 255, 0.12);
        color: rgba(255, 255, 255, 0.8);
      }

      .tab-panel {
        display: grid;
        gap: 0.7rem;
      }

      .data-table {
        display: grid;
        gap: 0.52rem;
      }

      .data-table-toolbar {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 0.48rem;
      }

      .data-table-filter {
        width: min(100%, 16rem);
      }

      .data-table-controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: 0.36rem;
      }

      .data-table-size {
        display: flex;
        align-items: center;
        gap: 0.28rem;
      }

      .data-table-size select {
        width: auto;
        min-width: 4.2rem;
      }

      .data-table-count {
        min-width: 7.75rem;
        margin: 0;
        text-align: right;
      }

      .data-table-pagination {
        display: inline-flex;
        gap: 0.16rem;
      }

      .data-table-pagination button {
        min-width: 1.7rem;
        padding-inline: 0.34rem;
      }

      tbody tr:nth-child(odd) td {
        background: rgba(255, 255, 255, 0.55);
      }

      tbody tr.is-clickable td {
        cursor: pointer;
      }

      .table-wrap .pill-success {
        box-shadow: inset 0 0 0 1px rgba(16, 39, 68, 0.32);
      }

      tbody tr.data-table-row-selected td {
        background: rgba(86, 146, 255, 0.14);
      }

      tbody tr:not(.data-table-row-selected):hover td {
        background: rgba(183, 243, 77, 0.18);
      }

      tbody tr.data-table-row-selected:hover td {
        background: rgba(86, 146, 255, 0.14);
      }

      .data-table-empty-cell {
        padding: 0.82rem 0.68rem;
        border-bottom: none;
      }

      .data-table-empty {
        display: grid;
        place-items: center;
        min-height: 4.5rem;
        border: 1px dashed rgba(13, 32, 56, 0.14);
        border-radius: var(--radius-card);
        color: var(--muted);
        background: rgba(255, 255, 255, 0.76);
      }

      .page-header-actions button,
      .page-header-actions .button-link,
      .data-table-pagination button,
      .tab-button {
        min-height: var(--control-height);
      }

      @media (max-width: 1100px) {
        .admin-shell {
          grid-template-columns: 1fr;
          height: auto;
          overflow: visible;
        }

        .admin-sidebar {
          position: static;
          height: auto;
          overflow: visible;
        }

        .sidebar-body {
          overflow: visible;
          padding-right: 0;
          scrollbar-gutter: auto;
        }

        .admin-main {
          height: auto;
          overflow: visible;
          scrollbar-gutter: auto;
        }
      }

      @media (max-width: 720px) {
        .admin-shell {
          padding: 0.55rem;
        }

        .panel {
          padding: 0.72rem;
        }

        .page-header-row,
        .data-table-toolbar,
        .section-head {
          align-items: stretch;
        }

        .data-table-controls,
        .page-header-actions {
          justify-content: flex-end;
          flex-wrap: wrap;
        }

        .data-table-count {
          min-width: 0;
          text-align: left;
        }

        .proxy-actions-toolbar,
        .resource-actions-toolbar {
          grid-template-columns: 1fr;
        }
      }
  `;
}

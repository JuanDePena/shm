export function renderBaseStyleBlock(): string {
  return `
      :root {
        color-scheme: light;
        --paper: #eef4fb;
        --paper-strong: #d8e5f4;
        --paper-muted: #c9d9eb;
        --surface: rgba(250, 253, 255, 0.94);
        --surface-strong: rgba(255, 255, 255, 0.96);
        --ink: #0d2038;
        --muted: #4c6481;
        --label-ink: #4b5563;
        --text-subtle: #7e8899;
        --line: rgba(13, 32, 56, 0.14);
        --line-strong: rgba(13, 32, 56, 0.22);
        --accent: #f28c28;
        --accent-soft: rgba(242, 140, 40, 0.16);
        --attention: #b7f34d;
        --attention-soft: rgba(183, 243, 77, 0.2);
        --success: #7ecf29;
        --success-soft: rgba(126, 207, 41, 0.18);
        --danger: #d4442f;
        --danger-soft: rgba(212, 68, 47, 0.14);
        --primary: #007fff;
        --primary-strong: #006fdf;
        --primary-border: #0f52ba;
        --primary-soft: rgba(0, 127, 255, 0.18);
        --navy-strong: #102744;
        --navy-soft: #18365b;
        --navy-deep: #0a1730;
        --navy-panel: rgba(10, 23, 48, 0.92);
        --font-scale-base: 85%;
        --font-size-kicker: 0.73rem;
        --font-size-label: 0.85rem;
        --font-size-meta: 0.8rem;
        --font-size-pill: 0.77rem;
        --font-size-heading-sm: 1rem;
        --font-size-heading-md: 1.2rem;
        --font-size-stat: 1.35rem;
        --font-size-stat-compact: 1.08rem;
        --font-size-hero: clamp(1.5rem, 2.35vw, 2.35rem);
        --font-size-page-title: clamp(1.34rem, 2.1vw, 1.92rem);
        --font-size-sidebar-title: clamp(0.94rem, 1.47vw, 1.34rem);
        --space-grid: 0.7rem;
        --space-stack: 0.58rem;
        --space-panel: 0.78rem;
        --space-panel-tight: 0.66rem;
        --space-control-block: 0.36rem;
        --space-control-inline: 0.62rem;
        --radius-control: 0.45rem;
        --radius-card: 5px;
        --radius-panel: 5px;
        --radius-hero: 1.05rem;
        --control-height: 1.92rem;
        font-family: "IBM Plex Sans", "Iosevka Etoile", sans-serif;
        background: #dce8f5;
        color: var(--ink);
      }

      * {
        box-sizing: border-box;
      }

      html {
        min-height: 100%;
        font-size: var(--font-scale-base);
      }

      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at 12% 10%, rgba(0, 142, 255, 0.34), transparent 24rem),
          radial-gradient(circle at 84% 8%, rgba(67, 217, 255, 0.3), transparent 22rem),
          radial-gradient(circle at 20% 84%, rgba(42, 114, 255, 0.24), transparent 22rem),
          radial-gradient(circle at 86% 82%, rgba(78, 225, 232, 0.26), transparent 26rem),
          linear-gradient(125deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0) 38%),
          linear-gradient(150deg, #eef6ff 0%, #d9ebff 32%, #d3e8f1 58%, #d8f0ef 78%, #e7f9e6 100%);
      }

      body.modal-open {
        overflow: hidden;
      }

      a {
        color: var(--accent);
        text-decoration: none;
      }

      a:hover {
        text-decoration: underline;
      }

      p {
        margin: 0;
        line-height: 1.45;
      }

      p + p {
        margin-top: 0.1rem;
      }

      ul,
      ol {
        margin: 0.08rem 0 0;
        padding-left: 2rem;
      }

      li {
        line-height: 1.42;
      }

      li + li {
        margin-top: 0.03rem;
      }

      code,
      pre,
      textarea,
      input,
      select,
      button {
        font: inherit;
      }

      button,
      .button-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: var(--control-height);
        font-size: 0.9rem;
        border: 1px solid var(--primary-border);
        border-radius: var(--radius-control);
        padding: var(--space-control-block) var(--space-control-inline);
        background: linear-gradient(135deg, var(--primary), var(--primary-strong));
        color: #f5fbff;
        cursor: pointer;
        box-shadow: 0 0.65rem 1.5rem rgba(0, 127, 255, 0.18);
      }

      .button-link:hover {
        text-decoration: none;
      }

      button.secondary,
      .button-link.secondary {
        background: linear-gradient(135deg, #ffc067, #ffc067);
        border: 1px solid #ce8946;
        color: #1b1309;
        box-shadow: 0 0.55rem 1.2rem rgba(255, 192, 103, 0.18);
      }

      button.danger,
      .button-link.danger {
        background: var(--danger);
        border-color: #b53c2a;
      }

      input,
      textarea,
      select {
        width: 100%;
        font-size: 0.88rem;
        padding: 0.48rem 0.64rem;
        border-radius: var(--radius-control);
        border: 1px solid rgba(16, 39, 68, 0.18);
        background: rgba(255, 255, 255, 0.92);
        color: var(--ink);
      }

      input,
      select {
        min-height: var(--control-height);
      }

      input[type="checkbox"],
      input[type="radio"] {
        width: auto;
        min-width: 1rem;
        min-height: 1rem;
        padding: 0;
        flex: 0 0 auto;
        accent-color: var(--primary);
      }

      input[readonly],
      textarea[readonly],
      select:disabled {
        border-color: rgba(16, 39, 68, 0.12);
        background: linear-gradient(180deg, rgba(236, 241, 247, 0.96), rgba(228, 234, 242, 0.96));
        color: rgba(16, 39, 68, 0.86);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
      }

      select {
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
        padding-right: 1.65rem;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(241, 247, 253, 0.96)),
          url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6.5 8 10l4-3.5' stroke='%23102744' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
        background-repeat: no-repeat, no-repeat;
        background-position: 0 0, right 0.36rem center;
        background-size: auto, 0.78rem;
        cursor: pointer;
      }

      select:hover {
        border-color: rgba(15, 82, 186, 0.32);
        box-shadow: 0 0.25rem 0.7rem rgba(15, 82, 186, 0.08);
      }

      select::-ms-expand {
        display: none;
      }

      select option {
        color: var(--ink);
        background: #f7fbff;
      }

      select option:checked {
        color: var(--navy-deep);
        background: #dceaff;
      }

      select[data-table-page-size] {
        padding-right: 0.64rem;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(241, 247, 253, 0.96));
      }

      .select-shell {
        position: relative;
        display: block;
      }

      .select-native-control {
        position: absolute !important;
        top: 0;
        left: 0;
        width: 100%;
        height: var(--control-height);
        opacity: 0;
        pointer-events: none;
      }

      .select-trigger {
        position: relative;
        width: 100%;
        min-height: var(--control-height);
        justify-content: flex-start;
        padding: 0.48rem 1.35rem 0.48rem 0.64rem;
        border: 1px solid rgba(16, 39, 68, 0.18);
        border-radius: var(--radius-control);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(241, 247, 253, 0.96));
        color: var(--ink);
        box-shadow: none;
        text-align: left;
      }

      .select-trigger:hover {
        border-color: rgba(15, 82, 186, 0.32);
        box-shadow: 0 0.25rem 0.7rem rgba(15, 82, 186, 0.08);
      }

      .select-trigger:focus-visible,
      .select-shell.is-open .select-trigger {
        outline: 2px solid rgba(183, 243, 77, 0.42);
        border-color: rgba(16, 39, 68, 0.42);
        box-shadow: 0 0 0 0.25rem rgba(183, 243, 77, 0.16);
      }

      .select-trigger-label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .select-trigger-icon {
        position: absolute;
        top: 50%;
        right: 0.22rem;
        width: 0.78rem;
        height: 0.78rem;
        transform: translateY(-50%);
        background:
          url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6.5 8 10l4-3.5' stroke='%23102744' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
          center / 0.78rem no-repeat;
        pointer-events: none;
      }

      .select-panel {
        position: absolute;
        top: calc(100% + 0.24rem);
        left: 0;
        right: 0;
        z-index: 40;
        display: grid;
        gap: 0.32rem;
        padding: 0.36rem;
        border: 1px solid rgba(16, 39, 68, 0.18);
        border-radius: var(--radius-control);
        background: rgba(250, 253, 255, 0.98);
        box-shadow: 0 1rem 2rem rgba(16, 39, 68, 0.14);
      }

      .select-panel[hidden] {
        display: none !important;
      }

      .select-search {
        padding: 0.44rem 0.58rem;
      }

      .select-options {
        display: grid;
        gap: 0.14rem;
        max-height: 13.5rem;
        overflow: auto;
        padding-right: 0.04rem;
        scrollbar-width: thin;
        scrollbar-color: rgba(16, 39, 68, 0.18) transparent;
      }

      .select-options::-webkit-scrollbar {
        width: 0.38rem;
      }

      .select-options::-webkit-scrollbar-thumb {
        background: rgba(16, 39, 68, 0.18);
        border-radius: 999px;
      }

      .select-option {
        width: 100%;
        min-height: 1.9rem;
        justify-content: flex-start;
        padding: 0.34rem 0.5rem;
        border: 1px solid transparent;
        border-radius: calc(var(--radius-control) - 1px);
        background: transparent;
        color: var(--ink);
        box-shadow: none;
        text-align: left;
      }

      .select-option:hover,
      .select-option:focus-visible {
        border-color: rgba(126, 207, 41, 0.28);
        background: rgba(183, 243, 77, 0.18);
        outline: none;
      }

      .select-option.is-selected {
        border-color: rgba(15, 82, 186, 0.28);
        background: #dceaff;
        color: var(--navy-deep);
      }

      .select-option.is-disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .proxy-vhost-modal {
        position: fixed;
        inset: 0;
        z-index: 90;
        display: grid;
        place-items: center;
        padding: 1rem;
      }

      .proxy-vhost-modal-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(10, 23, 48, 0.46);
        backdrop-filter: blur(0.16rem);
      }

      .proxy-vhost-modal-dialog {
        position: relative;
        z-index: 1;
        width: min(81.5rem, calc(100vw - 2rem));
        max-height: calc(100vh - 2rem);
      }

      .proxy-vhost-modal-panel {
        max-height: calc(100vh - 2rem);
        overflow: auto;
      }

      .proxy-vhost-modal-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .proxy-vhost-modal-close {
        flex-shrink: 0;
        min-width: 5.2rem;
      }

      .zone-records-modal-dialog {
        width: min(56rem, calc(100vw - 2rem));
      }

      .overlay-form-modal-dialog {
        width: min(46rem, calc(100vw - 2rem));
      }

      .overlay-form-modal-panel {
        max-height: calc(100vh - 2rem);
        overflow: auto;
      }

      .zone-records-modal-editor {
        min-height: 18rem;
      }

      .proxy-vhost-preview-grid {
        display: grid;
        gap: var(--space-grid);
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .proxy-vhost-preview-panel {
        display: grid;
        grid-template-rows: auto 1fr;
        min-width: 0;
      }

      .proxy-vhost-preview-panel .section-head {
        display: flex;
        align-items: center;
        min-height: 3.05rem;
      }

      .proxy-vhost-preview-panel .code-block {
        min-height: 22rem;
        margin-top: 0;
      }

      .code-block.code-block-light {
        background: linear-gradient(180deg, rgba(239, 243, 247, 0.96), rgba(230, 235, 241, 0.96));
        color: var(--navy-strong);
        border-color: rgba(13, 32, 56, 0.12);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
        font-family: "Iosevka Etoile", "IBM Plex Mono", monospace;
      }

      .code-block-numbered {
        padding: 0;
      }

      .code-block-lines {
        display: grid;
        min-width: max-content;
      }

      .code-block-line {
        display: grid;
        grid-template-columns: 1.6rem minmax(0, 1fr);
        align-items: start;
      }

      .code-block-line + .code-block-line {
        border-top: 1px solid rgba(13, 32, 56, 0.05);
      }

      .code-block-line-number {
        display: inline-flex;
        justify-content: flex-end;
        padding: 0.14rem 0.24rem 0.14rem 0.14rem;
        border-right: 1px solid rgba(13, 32, 56, 0.1);
        background: rgba(183, 243, 77, 0.44);
        color: var(--navy-deep);
        font-family: "Iosevka Etoile", "IBM Plex Mono", monospace;
        font-size: 0.76rem;
        line-height: 1.52;
        user-select: none;
      }

      .code-block-line-text {
        display: block;
        padding: 0.14rem 0.28rem;
        white-space: pre;
        font-family: "Iosevka Etoile", "IBM Plex Mono", monospace;
        font-size: 0.8rem;
        line-height: 1.52;
      }

      .select-empty {
        padding: 0.46rem 0.52rem;
        border: 1px dashed rgba(16, 39, 68, 0.14);
        border-radius: calc(var(--radius-control) - 1px);
        color: var(--muted);
        font-size: 0.82rem;
        text-align: center;
        background: rgba(255, 255, 255, 0.7);
      }

      .select-shell.is-disabled .select-trigger {
        opacity: 0.7;
        cursor: not-allowed;
      }

      @supports (appearance: base-select) and selector(::picker(select)) {
        select,
        ::picker(select) {
          appearance: base-select;
        }

        ::picker(select) {
          border: 1px solid rgba(16, 39, 68, 0.18);
          border-radius: var(--radius-control);
          background: rgba(250, 253, 255, 0.98);
          box-shadow: 0 1rem 2rem rgba(16, 39, 68, 0.14);
        }

        select option {
          padding: 0.48rem 0.64rem;
          color: var(--ink);
          background: #f7fbff;
        }

        select option:checked {
          background: #dceaff;
        }
      }

      input:focus,
      textarea:focus,
      select:focus {
        outline: 2px solid rgba(183, 243, 77, 0.42);
        border-color: rgba(16, 39, 68, 0.42);
        box-shadow: 0 0 0 0.25rem rgba(183, 243, 77, 0.16);
      }

      label {
        display: grid;
        gap: 0.3rem;
        color: var(--label-ink);
        font-size: var(--font-size-label);
      }

      textarea {
        min-height: 7rem;
        resize: vertical;
      }

      [hidden] {
        display: none !important;
      }

      .notice {
        padding: 0.75rem 0.9rem;
        border-radius: var(--radius-card);
        border: 1px solid var(--line);
      }

      .notice-success {
        background: var(--attention-soft);
        border-color: rgba(126, 207, 41, 0.32);
      }

      .notice-error {
        background: var(--danger-soft);
        border-color: rgba(212, 68, 47, 0.28);
      }

      .notice-info {
        background: var(--accent-soft);
        border-color: rgba(242, 140, 40, 0.28);
      }

      .grid {
        display: grid;
        gap: var(--space-grid);
        align-items: start;
      }

      .grid-two {
        grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
      }

      .grid-three {
        grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
      }

      .grid-two-desktop {
        display: grid;
        gap: var(--space-grid);
      }

      .grid-node-health-focus {
        grid-template-columns: minmax(0, 1.7fr) minmax(21rem, 0.9fr);
        align-items: start;
      }

      .grid-node-health-focus-spaced {
        margin-top: 0.8rem;
      }

      .grid-span-all {
        grid-column: 1 / -1;
      }

      .stack {
        display: grid;
        gap: var(--space-stack);
      }

      .toolbar,
      .inline-form,
      .form-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 0.55rem;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
      }

      .form-field-span-full {
        grid-column: 1 / -1;
      }

      .filter-form-grid {
        grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      }

      .selection-fieldset {
        margin: 0;
        padding: 0;
        border: none;
        display: grid;
        gap: 0.38rem;
      }

      .selection-fieldset legend {
        padding: 0;
        color: var(--muted);
        font-size: var(--font-size-label);
      }

      .selection-grid {
        display: grid;
        gap: 0.42rem;
        grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      }

      .selection-option {
        display: flex;
        align-items: flex-start;
        gap: 0.45rem;
        padding: 0.48rem 0.56rem;
        border: 1px solid rgba(13, 32, 56, 0.08);
        border-radius: var(--radius-card);
        background: rgba(255, 255, 255, 0.72);
        color: var(--ink);
        font-size: 0.84rem;
      }

      .selection-option input[type="checkbox"] {
        margin: 0.13rem 0 0;
      }

      .selection-option-copy {
        display: grid;
        gap: 0.08rem;
        min-width: 0;
      }

      .selection-option-copy strong {
        font-size: 0.84rem;
      }

      .selection-option-copy small {
        color: var(--muted);
        font-size: 0.74rem;
        overflow-wrap: anywhere;
      }

      .checkbox-inline {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        min-width: 0;
        color: var(--ink);
        font-size: 0.84rem;
      }

      .checkbox-inline span {
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .panel {
        padding: var(--space-panel);
        border: 1px solid var(--line);
        border-radius: var(--radius-panel);
        background: var(--surface);
        box-shadow: 0 1.1rem 2.6rem rgba(16, 39, 68, 0.08);
      }

      .panel-muted {
        background:
          linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(245, 249, 253, 0.92)),
          linear-gradient(145deg, rgba(16, 39, 68, 0.03), rgba(242, 140, 40, 0.06));
        border-color: rgba(13, 32, 56, 0.08);
        box-shadow: 0 0.8rem 2rem rgba(16, 39, 68, 0.05);
      }

      .danger-shell {
        border-color: rgba(212, 68, 47, 0.18);
        background:
          linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(252, 241, 239, 0.92)),
          linear-gradient(145deg, rgba(212, 68, 47, 0.05), rgba(255, 255, 255, 0.92));
      }

      .panel h2,
      .panel h3 {
        margin: 0;
      }

      .panel h2 {
        font-size: var(--font-size-heading-sm);
      }

      .detail-shell {
        display: grid;
        gap: 0.26rem;
      }

      .detail-shell > .signal-strip + * {
        margin-top: -0.12rem;
      }

      .filter-shell {
        gap: 0.5rem;
      }

      .filter-form-actions {
        justify-content: flex-start;
      }

      .detail-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
        gap: 0.55rem;
        margin: 0;
      }

      .detail-grid-four {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .detail-grid-three {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .detail-grid-compact {
        gap: 0.4rem;
      }

      .detail-item {
        padding: 0.68rem 0.75rem;
        border: 1px solid rgba(13, 32, 56, 0.08);
        border-radius: var(--radius-card);
        background: rgba(255, 255, 255, 0.72);
      }

      .detail-grid-compact .detail-item {
        padding: 0.46rem 0.56rem;
      }

      .detail-item-span-full {
        grid-column: 1 / -1;
      }

      .detail-item-span-two {
        grid-column: span 2;
      }

      .detail-item-span-two-auto {
        grid-column: span 2;
      }

      .detail-item dt {
        color: var(--muted);
        font-size: 0.69rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .detail-item dd {
        margin: 0.22rem 0 0;
        color: var(--ink);
        font-weight: 600;
        font-size: 0.92rem;
      }

      .deliverability-card-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.55rem;
        margin-top: 0.1rem;
      }

      .deliverability-status-card,
      .deliverability-metric-card {
        padding: 0.62rem 0.72rem;
      }

      .deliverability-status-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.7rem;
      }

      .deliverability-status-card dt,
      .deliverability-metric-card dt {
        margin: 0;
        color: var(--muted);
        font-size: 0.78rem;
        letter-spacing: 0.08em;
      }

      .deliverability-status-card dd,
      .deliverability-metric-card dd {
        margin: 0;
        display: inline-flex;
        align-items: center;
        justify-content: flex-end;
        flex: 0 0 auto;
      }

      .deliverability-status-card .pill,
      .deliverability-metric-card .pill {
        border: 1px solid rgba(13, 32, 56, 0.12);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
      }

      .deliverability-status-card .pill-success,
      .deliverability-metric-card .pill-success {
        border-color: rgba(126, 207, 41, 0.34);
      }

      .deliverability-status-card .pill-danger,
      .deliverability-metric-card .pill-danger {
        border-color: rgba(212, 68, 47, 0.26);
      }

      .deliverability-status-card .pill-muted,
      .deliverability-metric-card .pill-muted {
        border-color: rgba(13, 32, 56, 0.12);
      }

      .deliverability-metric-card-wide .deliverability-status-row {
        align-items: flex-start;
      }

      .deliverability-metric-card-wide dd {
        flex: 1 1 auto;
        min-width: 0;
        text-align: right;
      }

      .deliverability-metric-text {
        display: inline-block;
        max-width: 100%;
        text-align: right;
        overflow-wrap: anywhere;
      }

      .detail-grid-compact .detail-item dt {
        font-size: 0.64rem;
      }

      .detail-grid-compact .detail-item dd {
        margin-top: 0.14rem;
        font-size: 0.88rem;
        overflow-wrap: anywhere;
      }

      .detail-link {
        color: var(--navy-strong);
        font-weight: 600;
      }

      .detail-link:hover {
        color: var(--navy-soft);
      }

      .code-block {
        margin: 0;
        padding: 0;
        border-radius: var(--radius-card);
        border: 1px solid rgba(13, 32, 56, 0.08);
        background: rgba(16, 39, 68, 0.96);
        color: #edf5ff;
        overflow: auto;
        font-size: 0.8rem;
        line-height: 1.45;
      }

      .panel-nested {
        padding: var(--space-panel-tight);
        background: rgba(255, 255, 255, 0.72);
        box-shadow: none;
      }

      .mail-ha-node-panel {
        gap: 0;
      }

      .mail-ha-node-columns {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        column-gap: 0.55rem;
        row-gap: 0;
        align-items: start;
      }

      .mail-ha-node-column {
        display: flex;
        flex-direction: column;
        gap: 0;
        margin: 0;
      }

      .mail-ha-node-column .detail-item {
        border-radius: 0;
      }

      .mail-ha-node-column .detail-item + .detail-item {
        margin-top: -1px;
      }

      .mail-ha-node-column .detail-item:first-child {
        border-top-left-radius: var(--radius-card);
        border-top-right-radius: var(--radius-card);
      }

      .mail-ha-node-column .detail-item:last-child {
        border-bottom-left-radius: var(--radius-card);
        border-bottom-right-radius: var(--radius-card);
      }

      .mail-section-column {
        display: grid;
        gap: var(--space-grid);
        align-content: start;
      }

      .feed-list {
        display: grid;
        gap: 0.5rem;
      }

      .feed-item {
        display: grid;
        gap: 0.3rem;
        padding: 0.68rem 0.75rem;
        border: 1px solid rgba(13, 32, 56, 0.08);
        border-radius: var(--radius-card);
        background: rgba(255, 255, 255, 0.72);
      }

      .feed-item-danger {
        border-color: rgba(212, 68, 47, 0.2);
        background: rgba(212, 68, 47, 0.06);
      }

      .feed-item-success {
        border-color: rgba(126, 207, 41, 0.22);
        background: rgba(126, 207, 41, 0.08);
      }

      .feed-item strong,
      .feed-item p {
        margin: 0;
      }

      .feed-item .code-block {
        margin-top: 0.2rem;
      }

      .feed-meta {
        color: var(--muted);
        font-size: var(--font-size-meta);
      }

      .stats {
        display: grid;
        gap: 0.6rem;
        grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      }

      .stat {
        padding: 0.72rem;
        border-radius: var(--radius-card);
        background:
          linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(238, 244, 251, 0.96)),
          linear-gradient(145deg, rgba(16, 39, 68, 0.05), rgba(183, 243, 77, 0.05));
        border: 1px solid rgba(13, 32, 56, 0.08);
      }

      .stat strong {
        display: block;
        font-size: var(--font-size-stat);
        line-height: 1;
      }

      .stat span {
        color: var(--muted);
        font-size: var(--font-size-label);
      }

      .stats-compact {
        margin-bottom: 0.7rem;
      }

      .stat-compact {
        padding: 0.62rem 0.72rem;
      }

      .stat-compact strong {
        font-size: var(--font-size-stat-compact);
      }

      .overview-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.05fr) minmax(23rem, 0.95fr);
        gap: 0.9rem;
        align-items: start;
      }

      .overview-main,
      .overview-metrics-column {
        display: grid;
        gap: 0.9rem;
        min-width: 0;
      }

      .overview-metric-panel {
        overflow: hidden;
        border: 1px solid rgba(13, 32, 56, 0.1);
        border-radius: var(--radius-card);
        background: rgba(255, 255, 255, 0.84);
      }

      .overview-metric-panel > h3,
      .overview-metric-panel-header {
        margin: 0;
        padding: 0.75rem 0.9rem;
        border-bottom: 1px solid rgba(13, 32, 56, 0.08);
        background: rgba(235, 242, 250, 0.78);
        color: var(--ink);
        font-size: var(--font-size-heading-sm);
      }

      .overview-metric-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.72rem;
      }

      .overview-metric-panel-header h3 {
        min-width: 0;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        color: inherit;
        font-size: inherit;
        line-height: 1.2;
      }

      .overview-interval-selector {
        display: flex;
        justify-content: flex-end;
        flex: 0 0 auto;
        width: 12rem;
        max-width: 100%;
      }

      .overview-interval-selector .select-shell {
        flex: 0 0 12rem;
        width: 12rem;
        max-width: 12rem;
      }

      .overview-interval-selector .select-trigger {
        display: flex;
        align-items: center;
        width: 12rem;
        min-height: 1.32rem;
        height: 1.32rem;
        padding: 0 1.5rem 0 0.52rem;
        border-color: rgba(13, 32, 56, 0.14);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(241, 247, 253, 0.96));
        color: var(--navy-strong);
        font-size: 0.72rem;
        font-weight: 700;
        line-height: 1;
        box-shadow: 0 0.42rem 1rem rgba(16, 39, 68, 0.08);
      }

      .overview-interval-selector .select-trigger-icon {
        right: 0.38rem;
      }

      .overview-interval-selector .select-panel {
        left: auto;
        right: 0;
        width: 12rem;
        min-width: 12rem;
        max-width: calc(100vw - 2rem);
        gap: 0.12rem;
        padding: 0.22rem;
      }

      .overview-interval-selector .select-options {
        gap: 0.08rem;
        max-height: none;
        overflow: visible;
        padding-right: 0;
      }

      .overview-interval-selector .select-option {
        min-height: 1.45rem;
        padding: 0.2rem 0.45rem;
        font-size: 0.72rem;
      }

      select.overview-interval-select {
        box-sizing: border-box;
        display: block;
        width: 12rem !important;
        min-width: 12rem !important;
        max-width: 12rem !important;
        min-height: 1.32rem !important;
        height: 1.32rem !important;
        padding: 0 1.5rem 0 0.52rem !important;
        border-radius: var(--radius-control);
        border: 1px solid rgba(13, 32, 56, 0.14);
        background-color: rgba(255, 255, 255, 0.86);
        color: var(--navy-strong);
        font-size: 0.72rem !important;
        font-weight: 700;
        line-height: 1 !important;
        box-shadow: 0 0.42rem 1rem rgba(16, 39, 68, 0.08);
      }

      select.overview-interval-select:focus,
      select.overview-interval-select:focus-visible {
        border-color: rgba(16, 39, 68, 0.3);
        outline: none;
        box-shadow:
          0 0 0 0.14rem rgba(86, 146, 255, 0.18),
          0 0.42rem 1rem rgba(16, 39, 68, 0.08);
      }

      .overview-status-content {
        display: grid;
        gap: 0.78rem;
        padding: 0.78rem;
      }

      .overview-status-content .stats + .muted {
        margin: -0.18rem 0 0;
      }

      .overview-signal-content {
        display: grid;
        gap: 0.58rem;
        padding: 0.78rem;
      }

      .overview-metric-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.58rem;
        padding: 0.78rem;
      }

      .overview-metric {
        display: grid;
        gap: 0.22rem;
        min-width: 0;
        min-height: 3.42rem;
        align-content: center;
        padding: 0.56rem 0.64rem;
        border: 1px solid rgba(13, 32, 56, 0.1);
        border-radius: var(--radius-card);
        background: rgba(255, 255, 255, 0.92);
      }

      .overview-metric span {
        color: var(--muted);
        font-size: var(--font-size-label);
        font-weight: 650;
        letter-spacing: 0;
        line-height: 1.2;
        text-transform: uppercase;
      }

      .overview-metric strong {
        min-width: 0;
        color: var(--ink);
        font-size: var(--font-size-stat-compact);
        line-height: 1.2;
        overflow-wrap: anywhere;
      }

      .overview-metric-wide {
        grid-column: 1 / -1;
      }

      @media (max-width: 980px) {
        .overview-layout {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 560px) {
        .overview-metric-panel-header {
          align-items: stretch;
          flex-direction: column;
        }

        .overview-interval-selector {
          width: 100%;
        }

        .overview-interval-selector .select-shell,
        .overview-interval-selector .select-trigger,
        .overview-interval-selector .select-panel {
          width: 100%;
          min-width: 0;
          max-width: none;
        }

        .overview-interval-selector .select-shell {
          flex-basis: 100%;
        }

        select.overview-interval-select {
          width: 100% !important;
          min-width: 0 !important;
          max-width: none !important;
          height: 1.5rem !important;
          min-height: 1.5rem !important;
        }

        .overview-metric-grid {
          grid-template-columns: 1fr;
        }
      }

      .table-wrap {
        overflow-x: auto;
        border: 1px solid rgba(13, 32, 56, 0.08);
        border-radius: var(--radius-card);
        background: rgba(255, 255, 255, 0.72);
      }

      .table-row-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        align-items: center;
        gap: 0.24rem;
      }

      .table-row-actions > button {
        min-width: 0;
        min-height: 1.62rem;
        padding: 0.18rem 0.52rem;
        font-size: 0.78rem;
        box-shadow: none;
        white-space: nowrap;
      }

      .mail-node-runtime-cell {
        display: grid;
        gap: 0.22rem;
        min-width: 0;
        font-size: 0.78rem;
        line-height: 1.35;
      }

      .mail-node-runtime-head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.32rem;
      }

      .mail-node-runtime-head .pill {
        padding: 0.08rem 0.34rem;
        font-size: 0.66rem;
        line-height: 1.1;
      }

      .mail-node-runtime-head > strong {
        color: var(--ink);
        font-size: 0.78rem;
        font-weight: 600;
      }

      .mail-node-runtime-subline {
        font-size: 0.68rem;
        line-height: 1.25;
      }

      #section-mail-runtime th:first-child,
      #section-mail-runtime td:first-child {
        width: 18rem;
      }

      #section-mail-runtime th:not(:first-child) {
        font-size: 0.64rem;
        letter-spacing: 0.1em;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th,
      td {
        padding: 0.48rem 0.4rem;
        border-bottom: 1px solid rgba(13, 32, 56, 0.09);
        vertical-align: top;
        text-align: left;
      }

      .table-col-node-health-codeserver {
        width: 16.8rem;
      }

      .table-col-node-summary {
        width: 30rem;
      }

      td.table-col-node-summary {
        max-width: 30rem;
      }

      @media (min-width: 901px) {
        .table-col-runtime-text-compact {
          width: 21rem;
          max-width: 21rem;
        }

        td.table-col-runtime-text-compact {
          overflow-wrap: anywhere;
          word-break: break-word;
        }
      }

      .node-health-code-server-cell {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.32rem;
        min-width: 0;
      }

      .node-health-code-server-cell > div {
        display: inline-flex;
      }

      .node-health-summary-cell {
        display: -webkit-box;
        overflow: hidden;
        max-width: 30rem;
        line-height: 1.34;
        word-break: break-word;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
      }

      th {
        position: sticky;
        top: 0;
        z-index: 1;
        color: #eff7ff;
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.11em;
        background:
          linear-gradient(180deg, rgba(10, 23, 48, 0.96), rgba(16, 39, 68, 0.94)),
          rgba(10, 23, 48, 0.94);
      }

      .comparison-table th:nth-child(1) {
        width: 14rem;
      }

      .comparison-table th:nth-child(4),
      .comparison-table td:nth-child(4) {
        width: 8rem;
      }

      .comparison-state-cell {
        white-space: nowrap;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.18rem 0.48rem;
        border-radius: 999px;
        font-size: var(--font-size-pill);
        background: var(--accent-soft);
        color: var(--accent);
      }

      .pill-success {
        background: var(--attention-soft);
        color: #557d16;
      }

      .pill-danger {
        background: var(--danger-soft);
        color: var(--danger);
      }

      .pill-muted {
        background: rgba(13, 32, 56, 0.08);
        color: var(--muted);
      }

      .muted {
        color: var(--muted);
      }

      .empty {
        margin: 0;
        color: var(--muted);
      }

      .section-note {
        margin: 0;
        padding: 0.62rem 0.75rem;
        border-radius: var(--radius-card);
        border: 1px dashed rgba(13, 32, 56, 0.16);
        background: rgba(255, 255, 255, 0.56);
      }

      details {
        border-top: 1px solid rgba(13, 32, 56, 0.08);
        padding-top: 0.75rem;
      }

      details.panel {
        border-top: none;
        padding-top: 1.15rem;
      }

      details.panel summary {
        list-style: none;
      }

      details.panel summary::-webkit-details-marker {
        display: none;
      }

      details + details {
        margin-top: 0.9rem;
      }

      summary {
        cursor: pointer;
        font-weight: 600;
      }

      .mono {
        font-family: "Iosevka Etoile", "IBM Plex Mono", monospace;
      }

      @media (max-width: 900px) {
        .grid-two,
        .grid-three,
        .grid-node-health-focus,
        .proxy-vhost-preview-grid {
          grid-template-columns: 1fr;
        }

        .grid-span-all {
          grid-column: auto;
        }

        .form-field-span-full {
          grid-column: auto;
        }

        .detail-grid-three,
        .detail-grid-four {
          grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
        }

        .mail-ha-node-columns {
          grid-template-columns: 1fr;
        }

        .deliverability-card-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .detail-item-span-two,
        .detail-item-span-two-auto {
          grid-column: 1 / -1;
        }

        .proxy-vhost-modal {
          padding: 0.66rem;
        }

        .proxy-vhost-modal-dialog,
        .proxy-vhost-modal-panel {
          max-height: calc(100vh - 1.32rem);
        }

        .proxy-vhost-modal-close {
          min-width: 0;
        }
      }

      @media (min-width: 901px) {
        .grid-two-desktop {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          align-items: start;
        }

        .proxy-workspace-columns,
        .resource-workspace-columns {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          align-items: start;
        }
      }

      @media (max-width: 560px) {
        .deliverability-card-grid {
          grid-template-columns: 1fr;
        }
      }
  `;
}

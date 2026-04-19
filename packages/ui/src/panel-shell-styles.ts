export function renderPanelShellStyleBlock(): string {
  return `
      .page {
        width: min(103rem, calc(100vw - 1.2rem));
        margin: 0.6rem auto 1.1rem;
      }

      .hero {
        display: grid;
        gap: 0.55rem;
        padding: 1rem 1.1rem 0.96rem;
        border: 1px solid rgba(13, 32, 56, 0.08);
        border-radius: var(--radius-hero);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.985), rgba(245, 248, 252, 0.97)),
          linear-gradient(135deg, rgba(13, 32, 56, 0.04), rgba(0, 127, 255, 0.045) 58%, rgba(255, 255, 255, 0.08));
        box-shadow: none;
      }

      .page-login {
        --login-column-width: 39rem;
        width: min(112rem, calc(100vw - 1.2rem));
        padding-top: 1rem;
      }

      .hero-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.8rem;
      }

      .hero-copy {
        display: grid;
        gap: 0.16rem;
        min-width: 0;
      }

      .hero-eyebrow {
        margin: 0;
        color: var(--navy-soft);
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: var(--font-size-kicker);
      }

      .hero-subheading {
        max-width: 52rem;
        margin: 0;
        color: var(--text-subtle);
        font-size: 0.98rem;
        line-height: 1.55;
      }

      h1 {
        margin: 0;
        font-size: var(--font-size-hero);
        line-height: 0.95;
      }

      .hero-center {
        max-width: 58rem;
        margin: 0 auto;
        padding: 1.25rem 1.25rem 1.1rem;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(246, 249, 253, 0.975)),
          linear-gradient(135deg, rgba(0, 116, 255, 0.06), rgba(42, 208, 255, 0.045) 55%, rgba(146, 235, 255, 0.075));
        border-color: rgba(13, 32, 56, 0.08);
        box-shadow: none;
      }

      .hero-center .hero-row {
        justify-content: center;
      }

      .hero-center .hero-copy {
        justify-items: center;
        text-align: center;
      }

      .hero-center .hero-subheading {
        max-width: 40rem;
      }

      .hero-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        align-items: center;
        gap: 0.35rem;
        margin-left: auto;
      }

      .login-shell {
        position: relative;
        padding: 1.4rem 0 2.4rem;
        margin-top: 0.95rem;
        justify-items: center;
      }

      .page-login .hero-center,
      .page-login .login-card,
      .page-login .notice {
        width: min(100%, var(--login-column-width));
        max-width: var(--login-column-width);
      }

      .login-card {
        margin: 0 auto;
        padding: 1.2rem 1.1rem 1.05rem;
        border-radius: 1.25rem;
        border: 1px solid rgba(11, 61, 145, 0.1);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(244, 251, 255, 0.92)),
          linear-gradient(140deg, rgba(0, 116, 255, 0.08), rgba(41, 209, 255, 0.04));
        box-shadow:
          0 1.55rem 3.6rem rgba(16, 39, 68, 0.16),
          0 0.4rem 1.2rem rgba(0, 127, 255, 0.08);
      }

      .login-card-header {
        display: grid;
        gap: 0.28rem;
        margin-bottom: 0.8rem;
      }

      .login-card-header h2 {
        margin: 0;
        font-size: 1.12rem;
      }

      .login-card-header p {
        color: var(--text-subtle);
        font-size: 0.92rem;
      }

      .login-card .stack {
        gap: 0.72rem;
      }

      .login-card .stack > label:first-child {
        margin-top: 0.34rem;
      }

      .login-card input {
        min-height: 2.6rem;
        padding: 0.66rem 0.82rem;
        border-color: rgba(11, 61, 145, 0.14);
        background: rgba(255, 255, 255, 0.95);
      }

      .login-card button {
        min-height: 2.7rem;
        font-size: 0.95rem;
        box-shadow: 0 0.9rem 2rem rgba(0, 127, 255, 0.22);
      }

      .page-login .notice {
        margin-left: auto;
        margin-right: auto;
      }

      @media (max-width: 720px) {
        .page {
          width: min(100vw - 0.6rem, 103rem);
        }

        .page-login {
          width: min(100vw - 0.6rem, 112rem);
          padding-top: 0.55rem;
        }

        .hero,
        .panel {
          padding: 0.78rem;
        }

        .hero-row {
          align-items: flex-start;
          flex-direction: column;
        }

        .hero-actions {
          width: 100%;
          margin-left: 0;
        }

        .hero-center {
          padding: 1rem 0.92rem;
        }

        .login-shell {
          padding-top: 1rem;
        }
      }
  `;
}

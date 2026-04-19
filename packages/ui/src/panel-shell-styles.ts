export function renderPanelShellStyleBlock(): string {
  return `
      .page {
        width: min(103rem, calc(100vw - 1.2rem));
        margin: 0.6rem auto 1.1rem;
      }

      .hero {
        display: grid;
        gap: 0.55rem;
        padding: 0.84rem;
        border: 1px solid var(--line);
        border-radius: var(--radius-hero);
        background:
          linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(236, 244, 251, 0.96)),
          linear-gradient(90deg, rgba(16, 39, 68, 0.06), rgba(183, 243, 77, 0.06));
        box-shadow: 0 1.5rem 4rem rgba(16, 39, 68, 0.14);
      }

      .page-login {
        position: relative;
        width: min(112rem, calc(100vw - 1.2rem));
        padding-top: 1rem;
        isolation: isolate;
      }

      .page-login::before,
      .page-login::after {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: -2;
      }

      .page-login::before {
        background:
          radial-gradient(circle at 16% 14%, rgba(0, 142, 255, 0.34), transparent 22rem),
          radial-gradient(circle at 84% 10%, rgba(67, 217, 255, 0.32), transparent 20rem),
          radial-gradient(circle at 22% 86%, rgba(42, 114, 255, 0.24), transparent 20rem),
          radial-gradient(circle at 86% 82%, rgba(78, 225, 232, 0.28), transparent 24rem),
          linear-gradient(140deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0));
        filter: saturate(118%);
      }

      .page-login::after {
        background:
          linear-gradient(120deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0) 42%),
          linear-gradient(160deg, rgba(15, 82, 186, 0.12), rgba(39, 174, 255, 0.08) 42%, rgba(144, 227, 255, 0.12) 100%);
        z-index: -3;
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
        color: var(--muted);
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
          linear-gradient(160deg, rgba(255, 255, 255, 0.92), rgba(234, 247, 255, 0.88)),
          linear-gradient(135deg, rgba(0, 116, 255, 0.12), rgba(42, 208, 255, 0.08) 55%, rgba(146, 235, 255, 0.14));
        border-color: rgba(11, 61, 145, 0.12);
        box-shadow:
          0 1.8rem 4rem rgba(11, 61, 145, 0.12),
          inset 0 1px 0 rgba(255, 255, 255, 0.65);
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

      .login-card {
        width: min(100%, 37rem);
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
        color: var(--muted);
        font-size: 0.92rem;
      }

      .login-card .stack {
        gap: 0.72rem;
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
        max-width: 38rem;
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

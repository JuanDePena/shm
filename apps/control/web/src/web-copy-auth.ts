import { type WebLocale } from "./request.js";
import { type WebCopyDictionary } from "./web-copy-types.js";

export const authCopyByLocale = {
  en: {
    appName: "SimpleHostMan",
    eyebrow: "SimpleHostMan control plane",
    loginTitle: "SimpleHostMan Login",
    loginHeading: "Operate your infrastructure from one control plane",
    loginDescription:
      "SimpleHostMan keeps DNS, proxying, databases, jobs, drift, and backups visible from a single operator workflow.",
    loginAccess: "Operator access",
    loginAccessDescription:
      "Sign in with your operator account to review changes, dispatch work, and manage the platform safely.",
    emailLabel: "Email",
    passwordLabel: "Password",
    signInLabel: "Sign in",
    signOutLabel: "Sign out",
    languageLabel: "Language",
    versionLabel: "Version",
    sidebarSearchPlaceholder: "Search navigation"
  },
  es: {
    appName: "SimpleHostMan",
    eyebrow: "Plano de control SimpleHostMan",
    loginTitle: "Acceso a SimpleHostMan",
    loginHeading: "Opera tu infraestructura desde un solo plano de control",
    loginDescription:
      "SimpleHostMan reúne DNS, proxy, bases de datos, trabajos, drift y backups en un flujo operativo único.",
    loginAccess: "Acceso de operador",
    loginAccessDescription:
      "Inicia sesión con tu cuenta de operador para revisar cambios, despachar trabajo y administrar la plataforma con seguridad.",
    emailLabel: "Correo",
    passwordLabel: "Contraseña",
    signInLabel: "Entrar",
    signOutLabel: "Salir",
    languageLabel: "Idioma",
    versionLabel: "Versión",
    sidebarSearchPlaceholder: "Buscar opción"
  }
} satisfies Record<WebLocale, WebCopyDictionary>;

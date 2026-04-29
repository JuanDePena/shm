import { type WebLocale } from "./request.js";
import { type WebCopyDictionary } from "./web-copy-types.js";

export const navigationCopyByLocale = {
  en: {
    navControlPlane: "Control plane",
    navOverview: "Overview",
    navContext: "Context",
    navOperations: "Operations",
    navNodeHealth: "Node health",
    navDrift: "Resource drift",
    navJobs: "Jobs",
    navBackups: "Backups",
    navRustDesk: "RustDesk",
    navServices: "Services",
    navLogs: "Logs",
    navResources: "Resources",
    navDesiredState: "Spec",
    navCreate: "Create",
    navTenants: "Tenants",
    navNodes: "Nodes",
    navZones: "DNS Zones",
    navProxies: "Proxies",
    navApps: "Apps",
    navDatabases: "Databases",
    navMail: "Mail",
    navBackupPolicies: "Backup policies",
    navPackages: "Packages",
    navFirewall: "Firewall",
    navFail2Ban: "Fail2Ban",
    navAudit: "Audit",
    tenantWorkspaceDescription: "Tenant scope, related resources and recent platform activity.",
    nodeWorkspaceDescription: "Health, desired topology and operator actions by node.",
    zoneWorkspaceDescription: "DNS zones, records, dispatch state and related drift.",
    proxyWorkspaceDescription: "Virtual hosts, proxy routing and operator-facing ingress per app.",
    appWorkspaceDescription: "Runtime topology, proxy operations and app-linked resources.",
    databaseWorkspaceDescription: "Database topology, reconcile posture and related operations.",
    mailWorkspaceDescription:
      "Mail domains, mailboxes, aliases, quotas and delivery topology for the platform mail stack.",
    backupWorkspaceDescription: "Policy definition, retention and coverage before backup runs.",
    servicesWorkspaceDescription:
      "Systemd posture for critical platform services across managed nodes.",
    logsWorkspaceDescription:
      "Recent journal entries for critical platform services across managed nodes.",
    firewallWorkspaceDescription:
      "Monitor firewalld posture and apply the SimpleHost baseline without leaving the control plane.",
    fail2banWorkspaceDescription:
      "Monitor jails, failed attempts and bans, then apply the managed SSH jail baseline.",
    rustdeskWorkspaceDescription:
      "Operator-facing RustDesk connection details, node runtime status and manual failover guidance."
  },
  es: {
    navControlPlane: "Plano de control",
    navOverview: "Resumen",
    navContext: "Contexto",
    navOperations: "Operaciones",
    navNodeHealth: "Salud de nodos",
    navDrift: "Drift de recursos",
    navJobs: "Jobs",
    navBackups: "Backups",
    navRustDesk: "RustDesk",
    navServices: "Servicios",
    navLogs: "Logs",
    navResources: "Recursos",
    navDesiredState: "Especificación",
    navCreate: "Crear",
    navTenants: "Tenants",
    navNodes: "Nodos",
    navZones: "Zonas DNS",
    navProxies: "Proxies",
    navApps: "Apps",
    navDatabases: "Bases de datos",
    navMail: "Mail",
    navBackupPolicies: "Políticas de backup",
    navPackages: "Paquetes",
    navFirewall: "Firewall",
    navFail2Ban: "Fail2Ban",
    navAudit: "Auditoría",
    tenantWorkspaceDescription:
      "Alcance del tenant, recursos relacionados y actividad reciente de plataforma.",
    nodeWorkspaceDescription: "Salud, topología deseada y acciones operativas por nodo.",
    zoneWorkspaceDescription: "Zonas DNS, registros, estado de dispatch y drift relacionado.",
    proxyWorkspaceDescription:
      "Virtual hosts, enrutamiento proxy e ingress operator-facing por app.",
    appWorkspaceDescription:
      "Topología runtime, operaciones de proxy y recursos vinculados a la app.",
    databaseWorkspaceDescription:
      "Topología de base de datos, estado de reconcile y operaciones relacionadas.",
    mailWorkspaceDescription:
      "Dominios mail, buzones, aliases, quotas y topología de entrega para el stack de correo de la plataforma.",
    backupWorkspaceDescription:
      "Definición de políticas, retención y cobertura antes de las ejecuciones.",
    servicesWorkspaceDescription:
      "Postura systemd de servicios críticos de plataforma en los nodos gestionados.",
    logsWorkspaceDescription:
      "Entradas recientes de journal para servicios críticos de plataforma en los nodos gestionados.",
    firewallWorkspaceDescription:
      "Monitorea la postura de firewalld y aplica el baseline SimpleHost sin salir del plano de control.",
    fail2banWorkspaceDescription:
      "Monitorea jails, intentos fallidos y bans, y aplica el baseline SSH gestionado.",
    rustdeskWorkspaceDescription:
      "Detalles operator-facing de conexión RustDesk, estado runtime por nodo y guía de failover manual."
  }
} satisfies Record<WebLocale, WebCopyDictionary>;

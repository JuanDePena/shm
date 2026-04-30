import { type WebLocale } from "./request.js";
import { type WebCopyDictionary } from "./web-copy-types.js";

export const navigationCopyByLocale = {
  en: {
    navControlPlane: "Control plane",
    navOverview: "Overview",
    navContext: "Context",
    navOperations: "Operations",
    navGroupContinuity: "Continuity",
    navGroupObservability: "Observability",
    navGroupPackages: "Packages",
    navGroupSecurity: "Security",
    navGroupSystem: "System",
    navNodeHealth: "Node health",
    navDrift: "Resource drift",
    navJobs: "Jobs",
    navBackups: "Backups",
    navRustDesk: "RustDesk",
    navUpdates: "Updates",
    navRepositories: "Repositories",
    navReboots: "Reboots",
    navConfig: "Config",
    navTime: "Time",
    navResolver: "Resolver",
    navAccounts: "Accounts",
    navServices: "Services",
    navLogs: "Logs",
    navCertificates: "TLS",
    navStorage: "Storage",
    navMounts: "Mounts",
    navKernel: "Kernel",
    navNetwork: "Network",
    navProcesses: "Processes",
    navContainers: "Containers",
    navTimers: "Timers",
    navSelinux: "SELinux",
    navSsh: "SSH",
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
    updatesWorkspaceDescription:
      "Available RPM updates and security advisories reported by managed nodes.",
    repositoriesWorkspaceDescription:
      "DNF/YUM repository posture and GPG policy reported by managed nodes.",
    rebootsWorkspaceDescription:
      "Kernel, uptime and reboot-required posture reported by managed nodes.",
    configWorkspaceDescription:
      "Configuration syntax checks for critical node-local services.",
    timeWorkspaceDescription:
      "Clock, timezone and NTP synchronization posture reported by managed nodes.",
    resolverWorkspaceDescription:
      "DNS resolver configuration and systemd-resolved posture reported by managed nodes.",
    accountsWorkspaceDescription:
      "Local account, login shell and sudo posture reported by managed nodes.",
    servicesWorkspaceDescription:
      "Systemd posture for critical platform services across managed nodes.",
    logsWorkspaceDescription:
      "Recent journal entries for critical platform services across managed nodes.",
    certificatesWorkspaceDescription:
      "Certificate inventory, SAN coverage and expiration posture across managed nodes.",
    storageWorkspaceDescription:
      "Filesystem, inode and important-path usage reported by managed nodes.",
    mountsWorkspaceDescription:
      "Mounted filesystems and fstab persistence posture reported by managed nodes.",
    kernelWorkspaceDescription:
      "Kernel release, selected sysctl parameters and loaded modules reported by managed nodes.",
    networkWorkspaceDescription:
      "Interfaces, routes and listening sockets reported by managed nodes.",
    processesWorkspaceDescription:
      "Load, memory and top process usage reported by managed nodes.",
    containersWorkspaceDescription:
      "Podman container inventory, state, images and published ports by node.",
    timersWorkspaceDescription:
      "Systemd timer schedule inventory and activation targets by node.",
    selinuxWorkspaceDescription:
      "SELinux effective mode, configured mode and loaded policy by node.",
    sshWorkspaceDescription:
      "SSH daemon posture, effective access policy and root key exposure by node.",
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
    navGroupContinuity: "Continuidad",
    navGroupObservability: "Observabilidad",
    navGroupPackages: "Paquetes",
    navGroupSecurity: "Seguridad",
    navGroupSystem: "Sistema",
    navNodeHealth: "Salud de nodos",
    navDrift: "Drift de recursos",
    navJobs: "Jobs",
    navBackups: "Backups",
    navRustDesk: "RustDesk",
    navUpdates: "Updates",
    navRepositories: "Repositorios",
    navReboots: "Reboots",
    navConfig: "Config",
    navTime: "Hora",
    navResolver: "Resolver DNS",
    navAccounts: "Cuentas",
    navServices: "Servicios",
    navLogs: "Logs",
    navCertificates: "TLS",
    navStorage: "Storage",
    navMounts: "Mounts",
    navKernel: "Kernel",
    navNetwork: "Red",
    navProcesses: "Procesos",
    navContainers: "Containers",
    navTimers: "Timers",
    navSelinux: "SELinux",
    navSsh: "SSH",
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
    updatesWorkspaceDescription:
      "Actualizaciones RPM disponibles y advisories de seguridad reportados por los nodos gestionados.",
    repositoriesWorkspaceDescription:
      "Postura de repositorios DNF/YUM y política GPG reportada por los nodos gestionados.",
    rebootsWorkspaceDescription:
      "Postura de kernel, uptime y reboot requerido reportada por los nodos gestionados.",
    configWorkspaceDescription:
      "Validaciones de sintaxis para configuraciones críticas locales del nodo.",
    timeWorkspaceDescription:
      "Postura de reloj, zona horaria y sincronización NTP reportada por los nodos gestionados.",
    resolverWorkspaceDescription:
      "Configuración de resolución DNS y postura de systemd-resolved reportada por los nodos gestionados.",
    accountsWorkspaceDescription:
      "Postura de cuentas locales, shells de login y sudo reportada por los nodos gestionados.",
    servicesWorkspaceDescription:
      "Postura systemd de servicios críticos de plataforma en los nodos gestionados.",
    logsWorkspaceDescription:
      "Entradas recientes de journal para servicios críticos de plataforma en los nodos gestionados.",
    certificatesWorkspaceDescription:
      "Inventario de certificados, cobertura SAN y postura de expiración en los nodos gestionados.",
    storageWorkspaceDescription:
      "Uso de filesystems, inodes y rutas importantes reportado por los nodos gestionados.",
    mountsWorkspaceDescription:
      "Filesystems montados y postura de persistencia en fstab reportados por los nodos gestionados.",
    kernelWorkspaceDescription:
      "Release de kernel, parámetros sysctl seleccionados y módulos cargados reportados por los nodos gestionados.",
    networkWorkspaceDescription:
      "Interfaces, rutas y sockets en escucha reportados por los nodos gestionados.",
    processesWorkspaceDescription:
      "Carga, memoria y top de procesos reportados por los nodos gestionados.",
    containersWorkspaceDescription:
      "Inventario Podman, estado, imágenes y puertos publicados por nodo.",
    timersWorkspaceDescription:
      "Inventario de timers systemd, horarios y unidades activadas por nodo.",
    selinuxWorkspaceDescription:
      "Modo efectivo, modo configurado y política SELinux cargada por nodo.",
    sshWorkspaceDescription:
      "Postura del daemon SSH, política efectiva de acceso y exposición de llaves root por nodo.",
    firewallWorkspaceDescription:
      "Monitorea la postura de firewalld y aplica el baseline SimpleHost sin salir del plano de control.",
    fail2banWorkspaceDescription:
      "Monitorea jails, intentos fallidos y bans, y aplica el baseline SSH gestionado.",
    rustdeskWorkspaceDescription:
      "Detalles operator-facing de conexión RustDesk, estado runtime por nodo y guía de failover manual."
  }
} satisfies Record<WebLocale, WebCopyDictionary>;

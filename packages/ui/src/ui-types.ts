export interface PanelNotice {
  kind: "success" | "error" | "info";
  message: string;
}

export interface PanelShellProps {
  lang?: string;
  title: string;
  heading: string;
  eyebrow?: string;
  subheading?: string;
  body: string;
  actions?: string;
  notice?: PanelNotice;
  pageClassName?: string;
  heroAlign?: "start" | "center";
}

export interface AdminNavItem {
  id: string;
  label: string;
  href: string;
  keywords?: string[];
  badge?: string;
  active?: boolean;
}

export interface AdminNavGroup {
  id: string;
  label: string;
  items: AdminNavItem[];
  defaultCollapsed?: boolean;
}

export interface AdminShellProps {
  lang?: string;
  title: string;
  appName: string;
  heading: string;
  eyebrow?: string;
  subheading?: string;
  body: string;
  headerActionsHtml?: string;
  versionLabel: string;
  versionValue: string;
  sidebarSearchPlaceholder: string;
  sidebarGroups: AdminNavGroup[];
  notice?: PanelNotice;
  historyReplaceUrl?: string;
  autoRefreshSeconds?: number;
}

export interface TabItem {
  id: string;
  label: string;
  badge?: string;
  href?: string;
  panelHtml: string;
}

export interface TabsProps {
  id: string;
  tabs: TabItem[];
  defaultTabId?: string;
}

export interface DataTableColumn {
  label: string;
  className?: string;
}

export interface DataTableRow {
  cells: string[];
  searchText: string;
  selectionKey?: string;
  selected?: boolean;
}

export interface DataTableProps {
  id: string;
  heading: string;
  description?: string;
  headingBadgeClassName?: string;
  headerActionsHtml?: string;
  restoreSelectionHref?: boolean;
  columns: DataTableColumn[];
  rows: DataTableRow[];
  emptyMessage: string;
  filterPlaceholder: string;
  rowsPerPageLabel: string;
  showingLabel: string;
  ofLabel: string;
  recordsLabel: string;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
}

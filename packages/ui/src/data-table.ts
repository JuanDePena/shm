import { escapeHtml } from "./html.js";
import type { DataTableProps } from "./ui-types.js";

export function renderDataTable(props: DataTableProps): string {
  const pageSizeOptions = props.pageSizeOptions ?? [10, 25, 50, 100];
  const defaultPageSize = props.defaultPageSize ?? pageSizeOptions[0] ?? 25;
  const headingBadgeClassName = props.headingBadgeClassName
    ? ` ${escapeHtml(props.headingBadgeClassName)}`
    : "";
  const headerHtml = props.columns
    .map(
      (column) =>
        `<th${column.className ? ` class="${escapeHtml(column.className)}"` : ""}>${escapeHtml(
          column.label
        )}</th>`
    )
    .join("");

  const rowsHtml = props.rows
    .map((row, rowIndex) => {
      const cellsHtml = row.cells
        .map((cell, index) => {
          const className = props.columns[index]?.className;
          return `<td${className ? ` class="${escapeHtml(className)}"` : ""}>${cell}</td>`;
        })
        .join("");

      return `<tr data-table-row${
        row.selected ? " class=\"data-table-row-selected\"" : ""
      } data-search="${escapeHtml(row.searchText.toLowerCase())}" data-row-index="${String(
        rowIndex
      )}"${
        row.selectionKey ? ` data-selection-key="${escapeHtml(row.selectionKey)}"` : ""
      }>${cellsHtml}</tr>`;
    })
    .join("");

  const emptyRowHtml = `<tr data-table-empty${props.rows.length === 0 ? "" : " hidden"}>
    <td colspan="${String(props.columns.length)}" class="data-table-empty-cell">
      <div class="data-table-empty">
        <strong>${escapeHtml(props.emptyMessage)}</strong>
      </div>
    </td>
  </tr>`;

  return `<section id="${escapeHtml(props.id)}" class="panel section-panel">
    <div class="section-head">
      <div>
        <div class="section-title-row">
          <h2>${escapeHtml(props.heading)}</h2>
          <span class="section-badge${headingBadgeClassName}">${String(props.rows.length)}</span>
        </div>
        ${
          props.description
            ? `<p class="muted section-description">${escapeHtml(props.description)}</p>`
            : ""
        }
      </div>
      ${props.headerActionsHtml ? `<div class="section-head-actions">${props.headerActionsHtml}</div>` : ""}
    </div>
    <div
      class="data-table"
      data-data-table
      data-table-id="${escapeHtml(props.id)}"
      ${props.restoreSelectionHref ? 'data-restore-selection-href="true"' : ""}
      data-showing-label="${escapeHtml(props.showingLabel)}"
      data-of-label="${escapeHtml(props.ofLabel)}"
      data-records-label="${escapeHtml(props.recordsLabel)}"
      data-empty-message="${escapeHtml(props.emptyMessage)}"
    >
      <div class="data-table-toolbar">
        <label class="data-table-filter">
          <span class="sr-only">${escapeHtml(props.filterPlaceholder)}</span>
          <input type="search" placeholder="${escapeHtml(props.filterPlaceholder)}" data-table-filter />
        </label>
        <div class="data-table-controls">
          <label class="data-table-size">
            <span>${escapeHtml(props.rowsPerPageLabel)}</span>
            <select data-table-page-size data-native-select="true">
              ${pageSizeOptions
                .map(
                  (option) =>
                    `<option value="${String(option)}"${option === defaultPageSize ? " selected" : ""}>${String(
                      option
                    )}</option>`
                )
                .join("")}
            </select>
          </label>
          <p class="data-table-count muted" data-table-count></p>
          <div class="data-table-pagination">
            <button type="button" class="secondary" data-table-first>&laquo;</button>
            <button type="button" class="secondary" data-table-prev>&lsaquo;</button>
            <button type="button" class="secondary" data-table-next>&rsaquo;</button>
            <button type="button" class="secondary" data-table-last>&raquo;</button>
          </div>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>${headerHtml}</tr>
          </thead>
          <tbody>
            ${rowsHtml}
            ${emptyRowHtml}
          </tbody>
        </table>
      </div>
    </div>
  </section>`;
}

import {
  escapeHtml,
  renderDataTable,
  type DataTableRow
} from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { renderActionFacts } from "./panel-renderers.js";
import { type WebLocale } from "./request.js";
import { type WebCopy } from "./web-copy.js";

type EnvironmentParameter = DashboardData["parameters"]["parameters"][number];

function parameterTone(
  parameter: EnvironmentParameter
): "default" | "success" | "danger" | "muted" {
  return parameter.source === "ui" ? "success" : "muted";
}

function booleanTone(value: boolean): "success" | "muted" {
  return value ? "success" : "muted";
}

function displayParameterValue(parameter: EnvironmentParameter): string {
  return parameter.displayValue.length > 160
    ? `${parameter.displayValue.slice(0, 157)}...`
    : parameter.displayValue;
}

function selectParameter(
  parameters: EnvironmentParameter[],
  focus: string | undefined
): EnvironmentParameter | undefined {
  return parameters.find((parameter) => parameter.key === focus) ?? parameters[0];
}

function buildParameterRows(args: {
  copy: WebCopy;
  parameters: EnvironmentParameter[];
  selectedParameter: EnvironmentParameter | undefined;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, parameters, selectedParameter, locale, formatDate, renderFocusLink, renderPill } =
    args;

  return parameters.map((parameter) => {
    const selected = parameter.key === selectedParameter?.key;

    return {
      selectionKey: parameter.key,
      selected,
      cells: [
        renderFocusLink(
          parameter.key,
          buildDashboardViewUrl("parameters", undefined, parameter.key),
          selected,
          copy.selectedStateLabel
        ),
        renderPill(
          parameter.source === "ui" ? copy.parameterUiLabel : copy.parameterRuntimeLabel,
          parameterTone(parameter)
        ),
        `<span class="mono">${escapeHtml(displayParameterValue(parameter))}</span>`,
        renderPill(
          parameter.sensitive ? copy.yesLabel : copy.noLabel,
          parameter.sensitive ? "danger" : "muted"
        ),
        renderPill(
          parameter.editable ? copy.yesLabel : copy.noLabel,
          booleanTone(parameter.editable)
        ),
        escapeHtml(formatDate(parameter.updatedAt, locale))
      ],
      searchText: [
        parameter.key,
        parameter.displayValue,
        parameter.description ?? "",
        parameter.source,
        parameter.sensitive ? "sensitive" : "",
        parameter.editable ? "editable" : ""
      ].join(" ")
    };
  });
}

function renderCreateParameterPanel(copy: WebCopy, currentPath: string): string {
  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.parameterCreateTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.parameterCreateDescription)}</p>
      </div>
    </div>
    <form method="post" action="/actions/parameters/upsert" class="stack">
      <input type="hidden" name="returnTo" value="${escapeHtml(currentPath)}" />
      <div class="form-grid">
        <label>
          <span>${escapeHtml(copy.parameterKeyLabel)}</span>
          <input
            name="key"
            required
            pattern="[A-Za-z_][A-Za-z0-9_]*"
            spellcheck="false"
            class="mono"
          />
        </label>
        <label>
          <span>${escapeHtml(copy.parameterValueLabel)}</span>
          <input name="value" required spellcheck="false" class="mono" />
        </label>
        <label class="form-field-span-full">
          <span>${escapeHtml(copy.parameterDescriptionLabel)}</span>
          <input name="description" />
        </label>
      </div>
      <label class="checkbox-inline">
        <input type="checkbox" name="sensitive" />
        <span>${escapeHtml(copy.parameterSensitiveLabel)}</span>
      </label>
      <div class="toolbar">
        <button type="submit">${escapeHtml(copy.parameterCreateAction)}</button>
      </div>
    </form>
  </article>`;
}

function renderSelectedParameterPanel(args: {
  copy: WebCopy;
  currentPath: string;
  locale: WebLocale;
  selectedParameter: EnvironmentParameter | undefined;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): string {
  const { copy, currentPath, locale, selectedParameter, formatDate, renderPill } = args;

  if (!selectedParameter) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noParameters)}</p></article>`;
  }

  const parameterFacts = renderActionFacts(
    [
      {
        label: copy.parameterKeyLabel,
        value: `<span class="mono">${escapeHtml(selectedParameter.key)}</span>`
      },
      {
        label: copy.parameterSourceLabel,
        value: renderPill(
          selectedParameter.source === "ui" ? copy.parameterUiLabel : copy.parameterRuntimeLabel,
          parameterTone(selectedParameter)
        )
      },
      {
        label: copy.parameterSensitiveLabel,
        value: renderPill(
          selectedParameter.sensitive ? copy.yesLabel : copy.noLabel,
          selectedParameter.sensitive ? "danger" : "muted"
        )
      },
      {
        label: copy.parameterEditableLabel,
        value: renderPill(
          selectedParameter.editable ? copy.yesLabel : copy.noLabel,
          booleanTone(selectedParameter.editable)
        )
      },
      {
        label: copy.parameterUpdatedAtLabel,
        value: escapeHtml(formatDate(selectedParameter.updatedAt, locale))
      },
      {
        label: copy.parameterCreatedAtLabel,
        value: escapeHtml(formatDate(selectedParameter.createdAt, locale))
      },
      {
        label: copy.parameterDescriptionLabel,
        value: escapeHtml(selectedParameter.description ?? copy.none)
      },
      {
        label: copy.parameterValueLabel,
        value: `<span class="mono">${escapeHtml(displayParameterValue(selectedParameter))}</span>`
      }
    ],
    { className: "action-card-facts-wide-labels" }
  );

  if (!selectedParameter.editable) {
    return `<article class="panel detail-shell">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(copy.parameterRuntimeReadOnlyTitle)}</h3>
          <p class="muted section-description">${escapeHtml(copy.parameterCannotDeleteRuntime)}</p>
        </div>
      </div>
      ${parameterFacts}
    </article>`;
  }

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.parameterEditTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.parametersSelectedDescription)}</p>
      </div>
    </div>
    ${parameterFacts}
    <form method="post" action="/actions/parameters/upsert" class="stack">
      <input type="hidden" name="returnTo" value="${escapeHtml(currentPath)}" />
      <input type="hidden" name="key" value="${escapeHtml(selectedParameter.key)}" />
      ${selectedParameter.sensitive ? `<input type="hidden" name="keepSensitiveWhenBlank" value="on" />` : ""}
      <div class="form-grid">
        <label>
          <span>${escapeHtml(copy.parameterKeyLabel)}</span>
          <input value="${escapeHtml(selectedParameter.key)}" disabled class="mono" />
        </label>
        <label>
          <span>${escapeHtml(copy.parameterValueLabel)}</span>
          <input
            name="value"
            spellcheck="false"
            class="mono"
            value="${selectedParameter.sensitive ? "" : escapeHtml(selectedParameter.value ?? "")}"
          />
        </label>
        <label class="form-field-span-full">
          <span>${escapeHtml(copy.parameterDescriptionLabel)}</span>
          <input name="description" value="${escapeHtml(selectedParameter.description ?? "")}" />
        </label>
      </div>
      ${
        selectedParameter.sensitive
          ? `<p class="muted section-description">${escapeHtml(copy.parameterKeepSensitiveValue)}</p>`
          : ""
      }
      <label class="checkbox-inline">
        <input type="checkbox" name="sensitive" ${selectedParameter.sensitive ? "checked" : ""} />
        <span>${escapeHtml(copy.parameterSensitiveLabel)}</span>
      </label>
      <div class="toolbar">
        <button type="submit">${escapeHtml(copy.parameterSaveAction)}</button>
      </div>
    </form>
    ${
      selectedParameter.deletable
        ? `<form method="post" action="/actions/parameters/delete" class="toolbar">
          <input type="hidden" name="returnTo" value="${escapeHtml(currentPath)}" />
          <input type="hidden" name="key" value="${escapeHtml(selectedParameter.key)}" />
          <button class="danger" type="submit" data-confirm="${escapeHtml(
            copy.parameterDeleteAction
          )}">${escapeHtml(copy.parameterDeleteAction)}</button>
        </form>`
        : ""
    }
  </article>`;
}

export function renderParametersWorkspace(args: {
  copy: WebCopy;
  data: DashboardData;
  locale: WebLocale;
  currentPath: string;
  focus?: string;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
  renderSignalStrip: (
    items: Array<{
      label: string;
      value: string;
      tone?: "default" | "success" | "danger" | "muted";
    }>
  ) => string;
}): string {
  const {
    copy,
    data,
    locale,
    currentPath,
    focus,
    formatDate,
    renderFocusLink,
    renderPill,
    renderSignalStrip
  } = args;
  const parameters = data.parameters.parameters;
  const selectedParameter = selectParameter(parameters, focus);
  const sensitiveCount = parameters.filter((parameter) => parameter.sensitive).length;
  const rows = buildParameterRows({
    copy,
    parameters,
    selectedParameter,
    locale,
    formatDate,
    renderFocusLink,
    renderPill
  });

  const table = renderDataTable({
    id: "section-parameters-table",
    heading: copy.parametersInventoryTitle,
    description: copy.parametersInventoryDescription,
    headingBadgeClassName: "section-badge-lime",
    columns: [
      { label: copy.parameterKeyLabel, className: "mono" },
      { label: copy.parameterSourceLabel },
      { label: copy.parameterValueLabel, className: "mono table-col-runtime-text-compact" },
      { label: copy.parameterSensitiveLabel },
      { label: copy.parameterEditableLabel },
      { label: copy.parameterUpdatedAtLabel }
    ],
    rows,
    emptyMessage: copy.noParameters,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 25
  });

  return `<section id="section-parameters" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.parameterKeyLabel, value: String(data.parameters.parameterCount), tone: data.parameters.parameterCount > 0 ? "success" : "muted" },
      { label: copy.parameterRuntimeLabel, value: String(data.parameters.runtimeCount), tone: data.parameters.runtimeCount > 0 ? "muted" : "success" },
      { label: copy.parameterUiManagedLabel, value: String(data.parameters.uiManagedCount), tone: data.parameters.uiManagedCount > 0 ? "success" : "muted" },
      { label: copy.parameterSensitiveLabel, value: String(sensitiveCount), tone: sensitiveCount > 0 ? "danger" : "success" }
    ])}
    ${table}
    <div class="grid-two-desktop">
      ${renderSelectedParameterPanel({
        copy,
        currentPath,
        locale,
        selectedParameter,
        formatDate,
        renderPill
      })}
      ${renderCreateParameterPanel(copy, currentPath)}
    </div>
  </section>`;
}

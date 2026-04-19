import { escapeHtml } from "@simplehost/ui";

type PillRenderer = (
  value: string,
  tone?: "default" | "success" | "danger" | "muted"
) => string;

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldSpanDetailItem(value: string): boolean {
  const plain = stripHtml(value);

  if (!plain) {
    return false;
  }

  const longestToken = plain
    .split(/\s+/)
    .reduce((longest, token) => Math.max(longest, token.length), 0);

  return plain.length >= 42 || longestToken >= 28;
}

export function renderDetailGrid(
  entries: Array<{ label: string; value: string; className?: string }>,
  options: { className?: string } = {}
): string {
  const className = options.className ? ` ${escapeHtml(options.className)}` : "";

  return `<dl class="detail-grid${className}">
    ${entries
      .map((entry) => {
        const entryClassNames = [
          entry.className,
          shouldSpanDetailItem(entry.value) ? "detail-item-span-two-auto" : undefined
        ]
          .filter(Boolean)
          .join(" ");

        return `<div class="detail-item${
          entryClassNames ? ` ${escapeHtml(entryClassNames)}` : ""
        }">
          <dt>${escapeHtml(entry.label)}</dt>
          <dd>${entry.value}</dd>
        </div>`;
      })
      .join("")}
  </dl>`;
}

export function renderSignalStripHtml(
  entries: Array<{ label: string; value: string; tone?: "default" | "success" | "danger" | "muted" }>,
  renderPill: PillRenderer
): string {
  return `<div class="stats stats-compact">
    ${entries
      .map(
        (entry) => `<article class="stat stat-compact">
          <strong>${entry.tone ? renderPill(entry.value, entry.tone) : escapeHtml(entry.value)}</strong>
          <span>${escapeHtml(entry.label)}</span>
        </article>`
      )
      .join("")}
  </div>`;
}

export function renderActionFacts(
  rows: Array<{ label: string; value: string }>,
  options: { className?: string } = {}
): string {
  const className = options.className ? ` ${escapeHtml(options.className)}` : "";

  return `<dl class="action-card-facts${className}">
      ${rows
        .map(
          (row) => `<div class="action-card-facts-row">
            <dt>${escapeHtml(row.label)}</dt>
            <dd>${row.value}</dd>
          </div>`
        )
        .join("")}
    </dl>`;
}

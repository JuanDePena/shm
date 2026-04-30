export function renderAdminShellClientScript(): string {
  return `(() => {
        const historyReplaceUrl = document.body.getAttribute("data-history-replace");

        if (historyReplaceUrl) {
          history.replaceState(null, "", historyReplaceUrl);
        }

        const workspaceFilterStoragePrefix = "simplehost:workspace-filters:";
        const workspaceFilterStorageKey = (view) =>
          view ? workspaceFilterStoragePrefix + view : "";
        const readWorkspaceFilters = (key) => {
          if (!key) {
            return {};
          }

          try {
            const rawValue = window.localStorage.getItem(key);
            const parsed = rawValue ? JSON.parse(rawValue) : {};
            return parsed && typeof parsed === "object" && !Array.isArray(parsed)
              ? parsed
              : {};
          } catch (_error) {
            return {};
          }
        };
        const writeWorkspaceFilters = (key, values) => {
          if (!key) {
            return;
          }

          const normalized = {};
          Object.entries(values).forEach(([name, value]) => {
            const nextValue = typeof value === "string" ? value.trim() : "";
            if (name && nextValue) {
              normalized[name] = nextValue;
            }
          });

          try {
            if (Object.keys(normalized).length === 0) {
              window.localStorage.removeItem(key);
            } else {
              window.localStorage.setItem(key, JSON.stringify(normalized));
            }
          } catch (_error) {
            // Ignore storage failures and keep the request-driven filter flow.
          }
        };
        const getWorkspaceFilterControls = (form) =>
          Array.from(form.querySelectorAll("input[name], select[name], textarea[name]")).filter(
            (control) => {
              if (
                !(
                  control instanceof HTMLInputElement ||
                  control instanceof HTMLSelectElement ||
                  control instanceof HTMLTextAreaElement
                )
              ) {
                return false;
              }

              if (control.name === "view") {
                return false;
              }

              return !(
                control instanceof HTMLInputElement &&
                ["button", "hidden", "reset", "submit"].includes(control.type)
              );
            }
          );
        const collectWorkspaceFilterValues = (form) => {
          const values = {};
          getWorkspaceFilterControls(form).forEach((control) => {
            const value = control.value.trim();
            if (value) {
              values[control.name] = value;
            }
          });
          return values;
        };
        const resolveWorkspaceFilterView = (element) => {
          const explicitView = element.getAttribute("data-filter-view") ?? "";
          if (explicitView) {
            return explicitView;
          }

          const viewInput = element.querySelector("input[name='view']");
          return viewInput instanceof HTMLInputElement ? viewInput.value : "";
        };

        document.querySelectorAll("[data-workspace-filter-form]").forEach((form) => {
          if (!(form instanceof HTMLFormElement)) {
            return;
          }

          const filterView = resolveWorkspaceFilterView(form);
          const storageKey = workspaceFilterStorageKey(filterView);
          const controls = getWorkspaceFilterControls(form);
          const fieldNames = Array.from(new Set(controls.map((control) => control.name)));

          if (!storageKey || fieldNames.length === 0) {
            return;
          }

          const currentUrl = new URL(window.location.href);
          const urlHasFilterParam = fieldNames.some((name) => currentUrl.searchParams.has(name));

          if (urlHasFilterParam) {
            writeWorkspaceFilters(storageKey, collectWorkspaceFilterValues(form));
          } else {
            const savedFilters = readWorkspaceFilters(storageKey);
            const savedEntries = Object.entries(savedFilters).filter(
              ([name, value]) =>
                fieldNames.includes(name) && typeof value === "string" && value.trim()
            );

            if (savedEntries.length > 0) {
              const nextUrl = new URL(window.location.href);
              const viewInput = form.querySelector("input[name='view']");
              const targetView =
                viewInput instanceof HTMLInputElement && viewInput.value
                  ? viewInput.value
                  : filterView;

              if (targetView && targetView !== "overview") {
                nextUrl.searchParams.set("view", targetView);
              }

              savedEntries.forEach(([name, value]) => {
                nextUrl.searchParams.set(name, String(value).trim());
              });

              if (nextUrl.href !== currentUrl.href) {
                window.location.replace(nextUrl.href);
                return;
              }
            }
          }

          form.addEventListener("submit", () => {
            writeWorkspaceFilters(storageKey, collectWorkspaceFilterValues(form));
          });
        });

        document.querySelectorAll("[data-workspace-filter-clear]").forEach((trigger) => {
          if (!(trigger instanceof HTMLElement)) {
            return;
          }

          const filterView = resolveWorkspaceFilterView(trigger);
          const storageKey = workspaceFilterStorageKey(filterView);

          if (!storageKey) {
            return;
          }

          trigger.addEventListener("click", () => {
            try {
              window.localStorage.removeItem(storageKey);
            } catch (_error) {
              // Ignore storage failures; the clear link still navigates to the unfiltered view.
            }
          });
        });

        const sidebarSearch = document.querySelector("[data-sidebar-search]");
        const navItems = Array.from(document.querySelectorAll("[data-nav-item]"));
        const navGroups = Array.from(document.querySelectorAll("[data-nav-group]"));
        const sidebarGroupStorageKey = "simplehost:sidebar:collapsed-groups:v1";
        let navScrollTicking = false;
        const readCollapsedSidebarGroups = () => {
          try {
            const rawValue = window.localStorage.getItem(sidebarGroupStorageKey);
            const parsed = rawValue ? JSON.parse(rawValue) : [];
            return new Set(Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : []);
          } catch (_error) {
            return new Set();
          }
        };
        const writeCollapsedSidebarGroups = (collapsedGroups) => {
          try {
            window.localStorage.setItem(
              sidebarGroupStorageKey,
              JSON.stringify(Array.from(collapsedGroups).sort())
            );
          } catch (_error) {
            // Ignore storage failures and keep the in-memory group state.
          }
        };
        const collapsedSidebarGroups = readCollapsedSidebarGroups();
        const setSidebarGroupCollapsed = (group, collapsed) => {
          if (!(group instanceof HTMLElement)) {
            return;
          }

          const links = group.querySelector("[data-nav-group-links]");
          const toggle = group.querySelector("[data-nav-group-toggle]");

          group.classList.toggle("sidebar-group-collapsed", collapsed);

          if (links instanceof HTMLElement) {
            links.hidden = collapsed;
          }

          if (toggle instanceof HTMLButtonElement) {
            toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
          }
        };
        const resolveSidebarGroupCollapsed = (group) => {
          if (!(group instanceof HTMLElement)) {
            return false;
          }

          const groupId = group.getAttribute("data-nav-group-id") ?? "";
          const activeGroup = group.getAttribute("data-nav-group-active") === "true";
          const defaultCollapsed =
            group.getAttribute("data-nav-group-default-collapsed") === "true";

          if (activeGroup) {
            return false;
          }

          return groupId ? collapsedSidebarGroups.has(groupId) : defaultCollapsed;
        };
        const applySidebarGroupState = () => {
          navGroups.forEach((group) => {
            setSidebarGroupCollapsed(group, resolveSidebarGroupCollapsed(group));
          });
        };

        navGroups.forEach((group) => {
          if (!(group instanceof HTMLElement)) {
            return;
          }

          const toggle = group.querySelector("[data-nav-group-toggle]");
          const groupId = group.getAttribute("data-nav-group-id") ?? "";

          if (!(toggle instanceof HTMLButtonElement)) {
            return;
          }

          toggle.addEventListener("click", () => {
            const collapsed = !group.classList.contains("sidebar-group-collapsed");
            setSidebarGroupCollapsed(group, collapsed);

            if (!groupId) {
              return;
            }

            if (collapsed) {
              collapsedSidebarGroups.add(groupId);
            } else {
              collapsedSidebarGroups.delete(groupId);
            }

            writeCollapsedSidebarGroups(collapsedSidebarGroups);
          });
        });

        applySidebarGroupState();

        const setActiveNav = (targetId) => {
          navItems.forEach((item) => {
            const href = item.getAttribute("href") ?? "";
            if (!href.startsWith("#")) {
              return;
            }
            item.classList.toggle("active", href === "#" + targetId);
          });
        };

        const syncActiveNav = () => {
          const currentHash = window.location.hash.slice(1);
          if (currentHash) {
            setActiveNav(currentHash);
            return;
          }

          const candidates = Array.from(
            document.querySelectorAll(".section-panel, [data-tab-panel]")
          ).filter((node) => !(node instanceof HTMLElement && node.hidden));

          let activeId = "";
          let bestDistance = Number.POSITIVE_INFINITY;

          candidates.forEach((node) => {
            if (!(node instanceof HTMLElement) || !node.id) {
              return;
            }

            const rect = node.getBoundingClientRect();
            if (rect.bottom <= 120) {
              return;
            }

            const distance = Math.abs(rect.top - 160);
            if (rect.top <= 220 && distance < bestDistance) {
              activeId = node.id;
              bestDistance = distance;
            }
          });

          if (!activeId) {
            const firstVisible = candidates.find(
              (node) => node instanceof HTMLElement && node.id
            );
            if (firstVisible instanceof HTMLElement) {
              activeId = firstVisible.id;
            }
          }

          if (activeId) {
            setActiveNav(activeId);
          }
        };

        if (sidebarSearch instanceof HTMLInputElement) {
          const updateSidebar = () => {
            const query = sidebarSearch.value.trim().toLowerCase();

            navItems.forEach((item) => {
              const searchValue = item.getAttribute("data-search") ?? "";
              item.style.display = !query || searchValue.includes(query) ? "" : "none";
            });

            navGroups.forEach((group) => {
              const hasVisibleItem = Array.from(group.querySelectorAll("[data-nav-item]")).some(
                (item) => item instanceof HTMLElement && item.style.display !== "none"
              );
              const links = group.querySelector("[data-nav-group-links]");
              const toggle = group.querySelector("[data-nav-group-toggle]");
              group.style.display = hasVisibleItem ? "" : "none";

              if (query && hasVisibleItem) {
                group.classList.remove("sidebar-group-collapsed");

                if (links instanceof HTMLElement) {
                  links.hidden = false;
                }

                if (toggle instanceof HTMLButtonElement) {
                  toggle.setAttribute("aria-expanded", "true");
                }
              } else if (!query) {
                setSidebarGroupCollapsed(group, resolveSidebarGroupCollapsed(group));
              }
            });
          };

          sidebarSearch.addEventListener("input", updateSidebar);
          updateSidebar();
        }

        document.querySelectorAll("[data-topbar-disclosure]").forEach((root) => {
          const toggle = root.querySelector("[data-topbar-toggle]");
          const panel = root.querySelector("[data-topbar-panel]");

          if (!(toggle instanceof HTMLButtonElement) || !(panel instanceof HTMLElement)) {
            return;
          }

          const closePanel = () => {
            panel.hidden = true;
            toggle.setAttribute("aria-expanded", "false");
          };

          const openPanel = () => {
            panel.hidden = false;
            toggle.setAttribute("aria-expanded", "true");
          };

          toggle.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (panel.hidden) {
              openPanel();
            } else {
              closePanel();
            }
          });

          root.addEventListener("click", (event) => {
            event.stopPropagation();
          });

          document.addEventListener("click", (event) => {
            if (!(event.target instanceof Node) || !root.contains(event.target)) {
              closePanel();
            }
          });

          document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
              closePanel();
            }
          });
        });

        const tabRoots = Array.from(document.querySelectorAll("[data-tabs]"));

        const getScopedTabs = (root, selector) =>
          Array.from(root.querySelectorAll(selector)).filter(
            (element) => element.closest("[data-tabs]") === root
          );

        const activateTab = (root, targetId, updateHash) => {
          const buttons = getScopedTabs(root, "[data-tab-button]");
          const panels = getScopedTabs(root, "[data-tab-panel]");
          const panelMatch = panels.find((panel) => panel.id === targetId);

          if (!panelMatch) {
            return;
          }

          buttons.forEach((button) => {
            const active = button.getAttribute("data-tab-target") === targetId;
            button.classList.toggle("active", active);
            button.setAttribute("aria-selected", active ? "true" : "false");
          });

          panels.forEach((panel) => {
            panel.hidden = panel.id !== targetId;
          });

          if (updateHash) {
            history.replaceState(null, "", "#" + targetId);
          }

          syncActiveNav();
        };

        tabRoots.forEach((root) => {
          const defaultTab = root.getAttribute("data-default-tab");
          const buttons = getScopedTabs(root, "[data-tab-button]");

          buttons.forEach((button) => {
            button.addEventListener("click", () => {
              const href = button.getAttribute("data-tab-href");
              if (href) {
                window.location.assign(href);
                return;
              }

              const targetId = button.getAttribute("data-tab-target");
              if (targetId) {
                activateTab(root, targetId, true);
              }
            });
          });

          const currentHash = window.location.hash.slice(1);
          const currentPanel = currentHash
            ? root.querySelector("#" + CSS.escape(currentHash))
            : null;
          if (currentPanel && currentPanel.closest("[data-tabs]") === root) {
            activateTab(root, currentHash, false);
          } else if (defaultTab) {
            activateTab(root, defaultTab, false);
          }
        });

        window.addEventListener("hashchange", () => {
          const currentHash = window.location.hash.slice(1);
          if (!currentHash) {
            syncActiveNav();
            return;
          }

          tabRoots.forEach((root) => {
            const panel = root.querySelector("#" + CSS.escape(currentHash));
            if (panel && panel.closest("[data-tabs]") === root) {
              activateTab(root, currentHash, false);
            }
          });

          syncActiveNav();
        });

        navItems.forEach((item) => {
          item.addEventListener("click", () => {
            const href = item.getAttribute("href");
            if (href && href.startsWith("#")) {
              setActiveNav(href.slice(1));
            }
          });
        });

        document.addEventListener(
          "scroll",
          () => {
            if (navScrollTicking) {
              return;
            }

            navScrollTicking = true;
            window.requestAnimationFrame(() => {
              syncActiveNav();
              navScrollTicking = false;
            });
          },
          { passive: true }
        );

        syncActiveNav();

        document.querySelectorAll("[data-data-table]").forEach((root) => {
          const filterInput = root.querySelector("[data-table-filter]");
          const pageSizeSelect = root.querySelector("[data-table-page-size]");
          const countNode = root.querySelector("[data-table-count]");
          const firstButton = root.querySelector("[data-table-first]");
          const prevButton = root.querySelector("[data-table-prev]");
          const nextButton = root.querySelector("[data-table-next]");
          const lastButton = root.querySelector("[data-table-last]");
          const body = root.querySelector("tbody");
          const rows = Array.from(root.querySelectorAll("[data-table-row]"));
          const emptyRow = root.querySelector("[data-table-empty]");
          const tableId = root.getAttribute("data-table-id") ?? "";
          const restoreSelectionHref =
            root.getAttribute("data-restore-selection-href") === "true";
          const pageSizeStorageKey = tableId
            ? "simplehost:data-table:" + tableId + ":page-size"
            : "";
          const filterStorageKey = tableId
            ? "simplehost:data-table:" + tableId + ":filter"
            : "";
          const selectionStorageKey = tableId
            ? "simplehost:data-table:" + tableId + ":selected-row"
            : "";
          let currentPage = 1;
          let selectedRowKey = "";
          let restoreSavedSelection = false;
          let pendingSelectionNavigation = restoreSelectionHref;

          if (!(filterInput instanceof HTMLInputElement) || !(pageSizeSelect instanceof HTMLSelectElement) || !(countNode instanceof HTMLElement) || !(body instanceof HTMLTableSectionElement)) {
            return;
          }

          const getRowSelectionKey = (row, index) => {
            const explicitKey = row.getAttribute("data-selection-key");

            if (explicitKey) {
              return explicitKey;
            }

            const primaryLink = row.querySelector("a[href]");

            if (primaryLink instanceof HTMLAnchorElement) {
              return primaryLink.getAttribute("href") ?? primaryLink.href;
            }

            const searchKey = row.getAttribute("data-search");

            if (searchKey) {
              return searchKey;
            }

            const rowIndex = row.getAttribute("data-row-index");

            return rowIndex ? "row:" + rowIndex : "row:" + String(index);
          };
          const rowSelectionKeyMap = new Map(
            rows.map((row, index) => [row, getRowSelectionKey(row, index)])
          );
          const persistSelectedRowKey = (nextKey) => {
            if (!selectionStorageKey || !nextKey) {
              return;
            }

            try {
              window.localStorage.setItem(selectionStorageKey, nextKey);
            } catch (_error) {
              // Ignore storage failures and keep the current in-memory selection.
            }
          };
          const clearVisibleSelection = () => {
            rows.forEach((row) => {
              row.classList.remove("data-table-row-selected");
            });
          };
          const applySelectedRow = (selectedRow) => {
            rows.forEach((row) => {
              row.classList.toggle("data-table-row-selected", row === selectedRow);
            });

            if (!selectedRow) {
              return;
            }

            selectedRowKey = rowSelectionKeyMap.get(selectedRow) ?? "";

            if (selectedRowKey) {
              persistSelectedRowKey(selectedRowKey);
            }
          };
          const findRowBySelectionKey = (selectionKey, targetRows) => {
            if (!selectionKey) {
              return null;
            }

            return (
              targetRows.find((row) => rowSelectionKeyMap.get(row) === selectionKey) ?? null
            );
          };

          const serverSelectedRow =
            rows.find((row) => row.classList.contains("data-table-row-selected")) ?? null;
          const serverSelectedRowKey = serverSelectedRow
            ? rowSelectionKeyMap.get(serverSelectedRow) ?? ""
            : "";

          if (serverSelectedRow) {
            selectedRowKey = serverSelectedRowKey;
          } else if (selectionStorageKey) {
            try {
              const savedSelectionKey = window.localStorage.getItem(selectionStorageKey);
              if (savedSelectionKey) {
                selectedRowKey = savedSelectionKey;
                restoreSavedSelection = true;
              }
            } catch (_error) {
              // Ignore storage failures and keep the server-provided selection.
            }
          }

          if (pageSizeStorageKey) {
            try {
              const savedPageSize = window.localStorage.getItem(pageSizeStorageKey);
              if (
                savedPageSize &&
                Array.from(pageSizeSelect.options).some((option) => option.value === savedPageSize)
              ) {
                pageSizeSelect.value = savedPageSize;
              }
            } catch (_error) {
              // Ignore storage failures and keep the server default.
            }
          }

          if (filterStorageKey) {
            try {
              const savedFilter = window.localStorage.getItem(filterStorageKey);
              if (savedFilter && !filterInput.value) {
                filterInput.value = savedFilter;
              }
            } catch (_error) {
              // Ignore storage failures and keep the server default.
            }
          }

          const updateTable = () => {
            const query = filterInput.value.trim().toLowerCase();
            const pageSize = Math.max(1, Number.parseInt(pageSizeSelect.value, 10) || 10);
            const filteredRows = rows.filter((row) => {
              const searchValue = row.getAttribute("data-search") ?? row.textContent ?? "";
              return !query || searchValue.includes(query);
            });
            const total = filteredRows.length;
            const pageCount = Math.max(1, Math.ceil(total / pageSize));

            if (restoreSavedSelection && selectedRowKey) {
              const restoredIndex = filteredRows.findIndex(
                (row) => rowSelectionKeyMap.get(row) === selectedRowKey
              );

              if (restoredIndex >= 0) {
                currentPage = Math.floor(restoredIndex / pageSize) + 1;
              }

              restoreSavedSelection = false;
            }

            currentPage = Math.min(currentPage, pageCount);
            const startIndex = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
            const endIndex = Math.min(currentPage * pageSize, total);
            const visibleRows = filteredRows.slice(startIndex > 0 ? startIndex - 1 : 0, endIndex);

            rows.forEach((row) => {
              row.hidden = true;
            });

            visibleRows.forEach((row) => {
              row.hidden = false;
            });

            if (visibleRows.length === 0) {
              clearVisibleSelection();
            } else {
              const nextSelectedRow =
                findRowBySelectionKey(selectedRowKey, visibleRows) ?? visibleRows[0] ?? null;

              applySelectedRow(nextSelectedRow);

              if (pendingSelectionNavigation) {
                pendingSelectionNavigation = false;

                if (nextSelectedRow) {
                  const nextSelectedRowKey = rowSelectionKeyMap.get(nextSelectedRow) ?? "";

                  if (nextSelectedRowKey && nextSelectedRowKey !== serverSelectedRowKey) {
                    const primaryLink = nextSelectedRow.querySelector("a[href]");

                    if (primaryLink instanceof HTMLAnchorElement) {
                      window.location.replace(primaryLink.href);
                      return;
                    }
                  }
                }
              }
            }

            if (emptyRow instanceof HTMLElement) {
              emptyRow.hidden = total !== 0;
            }

            const showingLabel = root.getAttribute("data-showing-label") ?? "Showing";
            const ofLabel = root.getAttribute("data-of-label") ?? "of";
            const recordsLabel = root.getAttribute("data-records-label") ?? "records";
            countNode.textContent =
              total === 0
                ? "0 " + recordsLabel
                : showingLabel + " " + startIndex + "-" + endIndex + " " + ofLabel + " " + total + " " + recordsLabel;

            [firstButton, prevButton].forEach((button) => {
              if (button instanceof HTMLButtonElement) {
                button.disabled = currentPage <= 1 || total === 0;
              }
            });

            [nextButton, lastButton].forEach((button) => {
              if (button instanceof HTMLButtonElement) {
                button.disabled = currentPage >= pageCount || total === 0;
              }
            });
          };

          filterInput.addEventListener("input", () => {
            currentPage = 1;
            if (filterStorageKey) {
              try {
                const nextFilter = filterInput.value.trim();
                if (nextFilter) {
                  window.localStorage.setItem(filterStorageKey, nextFilter);
                } else {
                  window.localStorage.removeItem(filterStorageKey);
                }
              } catch (_error) {
                // Ignore storage failures and keep filtering in-memory.
              }
            }
            updateTable();
          });

          pageSizeSelect.addEventListener("change", () => {
            currentPage = 1;
            if (pageSizeStorageKey) {
              try {
                window.localStorage.setItem(pageSizeStorageKey, pageSizeSelect.value);
              } catch (_error) {
                // Ignore storage failures and keep the current in-memory page size.
              }
            }
            updateTable();
          });

          if (firstButton instanceof HTMLButtonElement) {
            firstButton.addEventListener("click", () => {
              currentPage = 1;
              updateTable();
            });
          }

          if (prevButton instanceof HTMLButtonElement) {
            prevButton.addEventListener("click", () => {
              currentPage = Math.max(1, currentPage - 1);
              updateTable();
            });
          }

          if (nextButton instanceof HTMLButtonElement) {
            nextButton.addEventListener("click", () => {
              currentPage += 1;
              updateTable();
            });
          }

          if (lastButton instanceof HTMLButtonElement) {
            lastButton.addEventListener("click", () => {
              const pageSize = Math.max(1, Number.parseInt(pageSizeSelect.value, 10) || 10);
              const visibleRows = rows.filter((row) => {
                const searchValue = row.getAttribute("data-search") ?? row.textContent ?? "";
                return !(filterInput.value.trim()) || searchValue.includes(filterInput.value.trim().toLowerCase());
              });
              currentPage = Math.max(1, Math.ceil(visibleRows.length / pageSize));
              updateTable();
            });
          }

          updateTable();
        });

        document.querySelectorAll("[data-table-row]").forEach((row) => {
          if (!(row instanceof HTMLTableRowElement)) {
            return;
          }

          const primaryLink = row.querySelector("a[href]");
          const selectRow = () => {
            const tableRoot = row.closest("[data-data-table]");

            if (!(tableRoot instanceof HTMLElement)) {
              row.classList.add("data-table-row-selected");
              return;
            }

            tableRoot.querySelectorAll("[data-table-row]").forEach((tableRow) => {
              tableRow.classList.toggle("data-table-row-selected", tableRow === row);
            });

            const tableId = tableRoot.getAttribute("data-table-id") ?? "";
            const selectionStorageKey = tableId
              ? "simplehost:data-table:" + tableId + ":selected-row"
              : "";
            const selectionKey =
              row.getAttribute("data-selection-key") ||
              (primaryLink instanceof HTMLAnchorElement
                ? primaryLink.getAttribute("href") ?? primaryLink.href
                : row.getAttribute("data-search") ??
                  row.getAttribute("data-row-index") ??
                  "");

            if (!selectionStorageKey || !selectionKey) {
              return;
            }

            try {
              window.localStorage.setItem(selectionStorageKey, selectionKey);
            } catch (_error) {
              // Ignore storage failures and still keep the in-memory highlight.
            }
          };

          if (primaryLink instanceof HTMLAnchorElement) {
            row.classList.add("is-clickable");
            primaryLink.addEventListener("click", () => {
              selectRow();
            });
          }

          row.addEventListener("click", (event) => {
            const target = event.target;

            if (!(target instanceof HTMLElement)) {
              return;
            }

            if (
              target.closest(
                "a, button, input, select, textarea, label, summary, [role='button'], [role='link']"
              )
            ) {
              return;
            }

            selectRow();

            if (!(primaryLink instanceof HTMLAnchorElement)) {
              return;
            }

            if (event.metaKey || event.ctrlKey) {
              window.open(primaryLink.href, "_blank", "noopener,noreferrer");
              return;
            }

            if (event.shiftKey) {
              window.open(primaryLink.href, "_blank");
              return;
            }

            window.location.assign(primaryLink.href);
          });
        });

        const isSpanish = (document.documentElement.lang || "").toLowerCase().startsWith("es");
        const selectSearchPlaceholder = isSpanish ? "Buscar opciones" : "Search options";
        const selectNoResultsLabel = isSpanish
          ? "No hay coincidencias"
          : "No matching options";
        const proxyVhostStrings = {
          title: isSpanish ? "Apache vhost" : "Apache vhost",
          description: isSpanish
            ? "Vista dual del redirect HTTP y del vhost HTTPS / SSL generados para el dominio seleccionado."
            : "Dual view of the generated HTTP redirect and HTTPS / SSL vhost for the selected domain.",
          http: "HTTP",
          https: "HTTPS / SSL",
          close: isSpanish ? "Cerrar" : "Close",
          loading: isSpanish ? "Cargando vista previa..." : "Loading preview...",
          error: isSpanish
            ? "No se pudo cargar la vista previa del Apache vhost."
            : "Unable to load the Apache vhost preview."
        };
        let activeSelectRoot = null;
        let activeOverlayModal = null;

        const closeSelectPanel = (root) => {
          if (!(root instanceof HTMLElement)) {
            return;
          }

          const trigger = root.querySelector(".select-trigger");
          const panel = root.querySelector(".select-panel");

          if (!(trigger instanceof HTMLButtonElement) || !(panel instanceof HTMLElement)) {
            return;
          }

          panel.hidden = true;
          root.classList.remove("is-open");
          trigger.setAttribute("aria-expanded", "false");

          if (activeSelectRoot === root) {
            activeSelectRoot = null;
          }
        };

        const openSelectPanel = (root) => {
          if (!(root instanceof HTMLElement)) {
            return;
          }

          const trigger = root.querySelector(".select-trigger");
          const panel = root.querySelector(".select-panel");
          const search = root.querySelector(".select-search");

          if (
            !(trigger instanceof HTMLButtonElement) ||
            !(panel instanceof HTMLElement) ||
            !(search instanceof HTMLInputElement)
          ) {
            return;
          }

          if (activeSelectRoot instanceof HTMLElement && activeSelectRoot !== root) {
            closeSelectPanel(activeSelectRoot);
          }

          panel.hidden = false;
          root.classList.add("is-open");
          trigger.setAttribute("aria-expanded", "true");
          activeSelectRoot = root;

          window.requestAnimationFrame(() => {
            search.focus();
            search.select();
          });
        };

        const moveSelectOptionFocus = (root, currentButton, direction) => {
          if (!(root instanceof HTMLElement) || !(currentButton instanceof HTMLButtonElement)) {
            return;
          }

          const options = Array.from(root.querySelectorAll(".select-option")).filter(
            (option) => option instanceof HTMLButtonElement && !option.disabled
          );
          const currentIndex = options.indexOf(currentButton);

          if (currentIndex === -1) {
            return;
          }

          const nextIndex = Math.min(
            Math.max(currentIndex + direction, 0),
            Math.max(options.length - 1, 0)
          );
          const nextOption = options[nextIndex];

          if (nextOption instanceof HTMLButtonElement) {
            nextOption.focus();
          }
        };

        document.querySelectorAll("select:not([multiple])").forEach((select) => {
          if (
            !(select instanceof HTMLSelectElement) ||
            select.closest(".select-shell") ||
            select.dataset.nativeSelect === "true"
          ) {
            return;
          }

          const parent = select.parentNode;

          if (!(parent instanceof HTMLElement)) {
            return;
          }

          const wrapper = document.createElement("div");
          wrapper.className = "select-shell";
          parent.insertBefore(wrapper, select);
          wrapper.appendChild(select);
          select.classList.add("select-native-control");
          select.tabIndex = -1;

          const trigger = document.createElement("button");
          trigger.type = "button";
          trigger.className = "select-trigger";
          trigger.setAttribute("aria-haspopup", "listbox");
          trigger.setAttribute("aria-expanded", "false");

          const triggerLabel = document.createElement("span");
          triggerLabel.className = "select-trigger-label";
          trigger.appendChild(triggerLabel);

          const triggerIcon = document.createElement("span");
          triggerIcon.className = "select-trigger-icon";
          triggerIcon.setAttribute("aria-hidden", "true");
          trigger.appendChild(triggerIcon);

          const panel = document.createElement("div");
          panel.className = "select-panel";
          panel.hidden = true;

          const search = document.createElement("input");
          search.type = "search";
          search.className = "select-search";
          search.placeholder = selectSearchPlaceholder;
          search.autocomplete = "off";
          search.spellcheck = false;

          const options = document.createElement("div");
          options.className = "select-options";
          options.setAttribute("role", "listbox");

          const empty = document.createElement("div");
          empty.className = "select-empty";
          empty.textContent = selectNoResultsLabel;
          empty.hidden = true;

          panel.appendChild(search);
          panel.appendChild(options);
          panel.appendChild(empty);
          wrapper.appendChild(trigger);
          wrapper.appendChild(panel);

          const syncTrigger = () => {
            const selectedOption =
              select.options[select.selectedIndex] ??
              Array.from(select.options).find((option) => !option.disabled) ??
              null;

            triggerLabel.textContent = selectedOption
              ? selectedOption.textContent || selectedOption.label || selectedOption.value || ""
              : "";
            trigger.disabled = select.disabled;
            wrapper.classList.toggle("is-disabled", select.disabled);
          };

          const renderOptions = () => {
            const query = search.value.trim().toLowerCase();
            options.textContent = "";
            let visibleCount = 0;

            Array.from(select.options).forEach((option, index) => {
              const label = option.textContent || option.label || option.value || "";
              const searchValue = (label + " " + option.value).trim().toLowerCase();

              if (query && !searchValue.includes(query)) {
                return;
              }

              const optionButton = document.createElement("button");
              optionButton.type = "button";
              optionButton.className = "select-option";
              optionButton.setAttribute("role", "option");
              optionButton.setAttribute("aria-selected", option.selected ? "true" : "false");
              optionButton.textContent = label || " ";

              if (option.selected) {
                optionButton.classList.add("is-selected");
              }

              if (option.disabled) {
                optionButton.disabled = true;
                optionButton.classList.add("is-disabled");
              }

              optionButton.addEventListener("click", () => {
                if (option.disabled) {
                  return;
                }

                select.selectedIndex = index;
                select.dispatchEvent(new Event("change", { bubbles: true }));
                syncTrigger();
                closeSelectPanel(wrapper);
                trigger.focus();
              });

              optionButton.addEventListener("keydown", (event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  moveSelectOptionFocus(wrapper, optionButton, 1);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  moveSelectOptionFocus(wrapper, optionButton, -1);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  closeSelectPanel(wrapper);
                  trigger.focus();
                }
              });

              options.appendChild(optionButton);
              visibleCount += 1;
            });

            empty.hidden = visibleCount !== 0;
          };

          trigger.addEventListener("click", (event) => {
            event.preventDefault();

            if (panel.hidden) {
              renderOptions();
              openSelectPanel(wrapper);
            } else {
              closeSelectPanel(wrapper);
            }
          });

          trigger.addEventListener("keydown", (event) => {
            if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              renderOptions();
              openSelectPanel(wrapper);
            }
          });

          search.addEventListener("input", () => {
            renderOptions();
          });

          search.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeSelectPanel(wrapper);
              trigger.focus();
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              const firstOption = options.querySelector(".select-option:not(.is-disabled)");
              if (firstOption instanceof HTMLButtonElement) {
                firstOption.focus();
              }
            }
          });

          select.addEventListener("change", () => {
            syncTrigger();
            if (!panel.hidden) {
              renderOptions();
            }
          });

          syncTrigger();
          renderOptions();
        });

        document.addEventListener("click", (event) => {
          if (!(activeSelectRoot instanceof HTMLElement) || !(event.target instanceof Node)) {
            return;
          }

          if (!activeSelectRoot.contains(event.target)) {
            closeSelectPanel(activeSelectRoot);
          }
        });

        document.addEventListener("keydown", (event) => {
          if (event.key !== "Escape" || !(activeSelectRoot instanceof HTMLElement)) {
            return;
          }

          if (activeOverlayModal instanceof HTMLElement) {
            return;
          }

          event.preventDefault();
          const trigger = activeSelectRoot.querySelector(".select-trigger");
          closeSelectPanel(activeSelectRoot);

          if (trigger instanceof HTMLButtonElement) {
            trigger.focus();
          }
        });

        const closeOverlayModal = (modal) => {
          if (!(modal instanceof HTMLElement)) {
            return;
          }

          modal.hidden = true;
          document.body.classList.remove("modal-open");

          if (activeOverlayModal === modal) {
            activeOverlayModal = null;
          }
        };

        const openOverlayModal = (modal) => {
          if (!(modal instanceof HTMLElement)) {
            return;
          }

          if (activeOverlayModal instanceof HTMLElement && activeOverlayModal !== modal) {
            closeOverlayModal(activeOverlayModal);
          }

          modal.hidden = false;
          document.body.classList.add("modal-open");
          activeOverlayModal = modal;
        };

        const renderNumberedCodeBlock = (container, text) => {
          if (!(container instanceof HTMLElement)) {
            return;
          }

          container.textContent = "";

          const linesRoot = document.createElement("div");
          linesRoot.className = "code-block-lines";
          const lines = String(text ?? "").replace(/\\r\\n/g, "\\n").split("\\n");

          lines.forEach((lineText, index) => {
            const line = document.createElement("div");
            line.className = "code-block-line";

            const lineNumber = document.createElement("span");
            lineNumber.className = "code-block-line-number";
            lineNumber.textContent = String(index + 1);

            const lineValue = document.createElement("span");
            lineValue.className = "code-block-line-text";
            lineValue.textContent = lineText || " ";

            line.appendChild(lineNumber);
            line.appendChild(lineValue);
            linesRoot.appendChild(line);
          });

          container.appendChild(linesRoot);
        };

        const setProxyVhostModalContent = (modal, preview, loadingErrorText) => {
          if (!(modal instanceof HTMLElement)) {
            return;
          }

          const title = modal.querySelector("[data-proxy-vhost-title]");
          const description = modal.querySelector("[data-proxy-vhost-description]");
          const domain = modal.querySelector("[data-proxy-vhost-domain]");
          const httpLabel = modal.querySelector("[data-proxy-vhost-http-label]");
          const httpsLabel = modal.querySelector("[data-proxy-vhost-https-label]");
          const httpCode = modal.querySelector("[data-proxy-vhost-http]");
          const httpsCode = modal.querySelector("[data-proxy-vhost-https]");

          if (title instanceof HTMLElement) {
            title.textContent = proxyVhostStrings.title;
          }

          if (description instanceof HTMLElement) {
            description.textContent = loadingErrorText ?? proxyVhostStrings.description;
          }

          if (httpLabel instanceof HTMLElement) {
            httpLabel.textContent = proxyVhostStrings.http;
          }

          if (httpsLabel instanceof HTMLElement) {
            httpsLabel.textContent = proxyVhostStrings.https;
          }

          if (domain instanceof HTMLElement) {
            if (preview && typeof preview.serverName === "string" && preview.serverName) {
              domain.textContent = preview.serverName;
              domain.hidden = false;
            } else {
              domain.hidden = true;
            }
          }

          if (httpCode instanceof HTMLElement) {
            renderNumberedCodeBlock(
              httpCode,
              preview && typeof preview.httpVhost === "string"
                ? preview.httpVhost
                : proxyVhostStrings.loading
            );
          }

          if (httpsCode instanceof HTMLElement) {
            renderNumberedCodeBlock(
              httpsCode,
              preview && typeof preview.httpsVhost === "string"
                ? preview.httpsVhost
                : proxyVhostStrings.loading
            );
          }
        };

        document.querySelectorAll("[data-proxy-vhost-modal]").forEach((modal) => {
          if (!(modal instanceof HTMLElement)) {
            return;
          }

          setProxyVhostModalContent(modal, null, proxyVhostStrings.description);

          modal.querySelectorAll("[data-proxy-vhost-close]").forEach((button) => {
            if (button instanceof HTMLButtonElement && !button.textContent?.trim()) {
              button.textContent = proxyVhostStrings.close;
            }

            button.addEventListener("click", (event) => {
              event.preventDefault();
              closeOverlayModal(modal);
            });
          });
        });

        document.querySelectorAll("[data-proxy-vhost-trigger]").forEach((link) => {
          if (!(link instanceof HTMLElement)) {
            return;
          }

          link.addEventListener("click", async (event) => {
            const modalId = link.getAttribute("data-modal-id");
            const previewUrl = link.getAttribute("data-preview-url");
            const modal = modalId ? document.getElementById(modalId) : null;

            if (!(modal instanceof HTMLElement) || !previewUrl) {
              return;
            }

            event.preventDefault();
            setProxyVhostModalContent(modal, null, proxyVhostStrings.description);
            openOverlayModal(modal);

            try {
              const response = await fetch(previewUrl, {
                headers: {
                  accept: "application/json"
                }
              });
              const responseText = await response.text();

              if (!response.ok) {
                throw new Error(responseText || response.statusText);
              }

              const preview = responseText ? JSON.parse(responseText) : null;
              setProxyVhostModalContent(modal, preview, proxyVhostStrings.description);
            } catch (_error) {
              setProxyVhostModalContent(
                modal,
                {
                  httpVhost: proxyVhostStrings.error,
                  httpsVhost: proxyVhostStrings.error
                },
                proxyVhostStrings.error
              );
            }
          });
        });

        document.querySelectorAll("[data-zone-records-modal]").forEach((modal) => {
          if (!(modal instanceof HTMLElement)) {
            return;
          }

          modal.querySelectorAll("[data-zone-records-close]").forEach((button) => {
            button.addEventListener("click", (event) => {
              event.preventDefault();
              closeOverlayModal(modal);
            });
          });
        });

        document.querySelectorAll("[data-zone-records-trigger]").forEach((button) => {
          if (!(button instanceof HTMLElement)) {
            return;
          }

          button.addEventListener("click", (event) => {
            const modalId = button.getAttribute("data-modal-id");
            const modal = modalId ? document.getElementById(modalId) : null;

            if (!(modal instanceof HTMLElement)) {
              return;
            }

            event.preventDefault();
            openOverlayModal(modal);

            const recordsInput = modal.querySelector("[data-zone-records-input]");
            if (recordsInput instanceof HTMLTextAreaElement) {
              window.requestAnimationFrame(() => {
                recordsInput.focus();
                recordsInput.setSelectionRange(recordsInput.value.length, recordsInput.value.length);
              });
            }
          });
        });

        document.querySelectorAll("[data-overlay-modal]").forEach((modal) => {
          if (!(modal instanceof HTMLElement)) {
            return;
          }

          modal.querySelectorAll("[data-overlay-close]").forEach((button) => {
            button.addEventListener("click", (event) => {
              event.preventDefault();
              closeOverlayModal(modal);
            });
          });
        });

        document.querySelectorAll("[data-overlay-trigger]").forEach((button) => {
          if (!(button instanceof HTMLElement)) {
            return;
          }

          button.addEventListener("click", (event) => {
            const modalId = button.getAttribute("data-modal-id");
            const modal = modalId ? document.getElementById(modalId) : null;

            if (!(modal instanceof HTMLElement)) {
              return;
            }

            event.preventDefault();
            openOverlayModal(modal);

            const autofocusTarget = modal.querySelector("[data-overlay-autofocus]");
            if (
              autofocusTarget instanceof HTMLInputElement ||
              autofocusTarget instanceof HTMLTextAreaElement ||
              autofocusTarget instanceof HTMLSelectElement ||
              autofocusTarget instanceof HTMLButtonElement
            ) {
              window.requestAnimationFrame(() => {
                autofocusTarget.focus();
              });
            }
          });
        });

        document.addEventListener("keydown", (event) => {
          if (event.key !== "Escape" || !(activeOverlayModal instanceof HTMLElement)) {
            return;
          }

          event.preventDefault();
          closeOverlayModal(activeOverlayModal);
        });

        document.addEventListener("keydown", (event) => {
          if (event.key !== "Escape" || event.defaultPrevented) {
            return;
          }

          if (activeOverlayModal instanceof HTMLElement) {
            return;
          }

          if (activeSelectRoot instanceof HTMLElement) {
            return;
          }

          const openTopbarPanel = document.querySelector("[data-topbar-panel]:not([hidden])");
          if (openTopbarPanel instanceof HTMLElement) {
            return;
          }

          if (window.history.length <= 1) {
            return;
          }

          event.preventDefault();
          window.history.back();
        });

        document.addEventListener("submit", (event) => {
          const submitEvent = event;
          const submitter =
            submitEvent instanceof SubmitEvent ? submitEvent.submitter : undefined;

          if (!(submitter instanceof HTMLElement)) {
            return;
          }

          const message = submitter.getAttribute("data-confirm");

          if (message && !window.confirm(message)) {
            event.preventDefault();
          }
        });
      })();`;
}

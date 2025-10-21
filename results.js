if (typeof chrome !== "undefined") {
  globalThis.browser = chrome;
}

document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("resultsContainer");
  const loadingMessage = document.getElementById("loadingMessage");

  // Function to format the timestamp (copied from background.js for rendering)
  function formatTimestamp(ms) {
    if (!ms) return "N/A";
    const date = new Date(ms);
    const yyyy = date.getFullYear();
    const MM = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const HH = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}`;
  }

  try {
    // 1. Retrieve the data from storage
    const data = await browser.storage.local.get([
      "groupedTabData",
      "groupingTitle",
      "groupType",
    ]);
    const groupedTabs = data.groupedTabData;
    const groupingTitle = data.groupingTitle || "Open Tab Organizer";
    const groupType = data.groupType || "date"; // Default to date if not set

    document.querySelector("h1").textContent = groupingTitle;

    if (!groupedTabs || Object.keys(groupedTabs).length === 0) {
      loadingMessage.textContent = "No tab data found or all tabs are closed.";
      return;
    }

    loadingMessage.style.display = "none";

    // 2. Sort and Render
    const sortedGroups = Object.keys(groupedTabs).sort();
    let html = "";

    for (const groupKey of sortedGroups) {
      // Sort tabs: by last accessed time if grouping by domain, or by time within the day if grouping by date
      const tabsForGroup = groupedTabs[groupKey].sort(
        (a, b) => b.lastAccessed - a.lastAccessed,
      );
      const groupTitle = groupKey;
      const dateTabIds = tabsForGroup.map((t) => t.id).join(",");

      html += `
                <div class="date-group">
                    <h2>
                        ${groupTitle} 
                        <span class="h2-actions">
                            <button class="move-window-btn" 
                                    data-ids="${dateTabIds}"
                                    title="Move all ${tabsForGroup.length} tabs in this group to a new window.">
                                Move to New Window (${tabsForGroup.length})
                            </button>
                            <button class="close-day-btn" 
                                    data-ids="${dateTabIds}"
                                    title="Close all ${tabsForGroup.length} tabs in this group.">
                                Close Group (${tabsForGroup.length})
                            </button>
                        </span>
                    </h2>
                    <ul>
            `;

      for (const tab of tabsForGroup) {
        // If grouping by domain, show the full timestamp. If grouping by date, show the time only.
        const timeOrDateStr =
          groupType === "domain"
            ? formatTimestamp(tab.lastAccessed)
            : formatTimestamp(tab.lastAccessed).substring(11);

        const title = tab.title
          ? tab.title
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
          : tab.url;
        const url = tab.url;

        html += `
                    <li data-id="${tab.id}">
                        <span class="time">[${timeOrDateStr}]</span>
                        <a href="${url}" target="_blank" title="${url}">${title}</a> 
                        <span class="actions">
                            <a href="#" class="action-btn go-btn" data-id="${tab.id}" title="Switch to this tab.">Go to Tab</a>
                            <a href="#" class="action-btn close-btn" data-id="${tab.id}" title="Close this single tab.">Close</a>
                        </span>
                        <span class="index">(Index: ${tab.index})</span>
                    </li>
                `;
      }

      html += `
                    </ul>
                </div>
            `;
    }

    container.innerHTML = html;

    // 3. Setup Action Listeners (unchanged)
    container.addEventListener("click", (e) => {
      const target = e.target;

      // --- Single Tab Actions (Go to Tab, Close) ---
      if (target.classList.contains("action-btn")) {
        e.preventDefault();
        const tabId = parseInt(target.dataset.id);

        if (target.classList.contains("go-btn")) {
          browser.runtime.sendMessage({ action: "goToTab", tabId: tabId });
        } else if (target.classList.contains("close-btn")) {
          if (confirm("Are you sure you want to close this single tab?")) {
            browser.runtime.sendMessage({
              action: "closeTabs",
              tabIds: [tabId],
            });
            target.closest("li").style.opacity = 0.5;
          }
        }
      }

      // --- Multi-Tab Actions (Close Group, Move to New Window) ---
      if (
        target.classList.contains("close-day-btn") ||
        target.classList.contains("move-window-btn")
      ) {
        e.preventDefault();

        // Get the array of tab IDs for the group
        const tabIds = target.dataset.ids.split(",").map((id) => parseInt(id));
        const dateHeader = target
          .closest(".date-group")
          .querySelector("h2")
          .innerText.split(" ")[0];
        const action = target.classList.contains("move-window-btn")
          ? "moveTabs"
          : "closeTabs";
        const actionVerb = action === "moveTabs" ? "move" : "close";

        // Set confirmation message specific to the new button text
        const confirmationMessage =
          action === "moveTabs"
            ? `Are you sure you want to move all ${tabIds.length} tabs from ${dateHeader} to a new window?`
            : `Are you sure you want to close all ${tabIds.length} tabs from ${dateHeader}?`;

        if (confirm(confirmationMessage)) {
          browser.runtime.sendMessage({ action: action, tabIds: tabIds });

          // Visual feedback for the entire group
          target.closest(".date-group").style.opacity = 0.5;
        }
      }
    });
  } catch (error) {
    loadingMessage.textContent = "An error occurred while loading data.";
    console.error("Error in results.js:", error);
  }
});

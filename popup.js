document.addEventListener("DOMContentLoaded", () => {
  const urlPatternInput = document.getElementById("urlPattern");
  const searchTabsButton = document.getElementById("searchTabsButton");
  const closeTabsButton = document.getElementById("closeTabsButton");
  const messageDiv = document.getElementById("message");
  const tabListContainer = document.getElementById("tabListContainer");
  const tabCountDiv = document.getElementById("tabCount");
  const matchingTabsList = document.getElementById("matchingTabsList");

  let currentMatchingTabIds = [];

  function patternToRegExp(pattern) {
    let regexString = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    regexString = regexString.replace(/\*/g, ".*");
    return new RegExp(`^${regexString}$`);
  }

  // Load saved pattern
  browser.storage.local.get("lastPattern").then((data) => {
    if (data.lastPattern) {
      urlPatternInput.value = data.lastPattern;
      searchAndDisplayTabs();
    }
  });

  searchTabsButton.addEventListener("click", () => {
    searchAndDisplayTabs();
  });

  closeTabsButton.addEventListener("click", async () => {
    if (currentMatchingTabIds.length === 0) {
      messageDiv.textContent = "No tabs to close.";
      messageDiv.style.color = "red";
      return;
    }

    const confirmation = confirm(
      `Are you sure you want to close ${currentMatchingTabIds.length} matching tabs?`,
    );
    if (confirmation) {
      messageDiv.textContent = "Closing tabs...";
      messageDiv.style.color = "#555";
      try {
        await browser.tabs.remove(currentMatchingTabIds);
        messageDiv.textContent = `Closed ${currentMatchingTabIds.length} tabs.`;
        messageDiv.style.color = "green";
        clearTabPreview();
        currentMatchingTabIds = [];
        updateCloseButtonState(0);
      } catch (error) {
        console.error("Error closing tabs:", error);
        messageDiv.textContent = `Error: ${error.message}`;
        messageDiv.style.color = "red";
      }
    } else {
      messageDiv.textContent = "Operation cancelled.";
      messageDiv.style.color = "orange";
    }
  });

  async function searchAndDisplayTabs() {
    let pattern = urlPatternInput.value.trim();
    clearTabPreview();
    currentMatchingTabIds = [];

    if (!pattern) {
      messageDiv.textContent = "Please enter a URL pattern to search.";
      messageDiv.style.color = "#555";
      updateCloseButtonState(0);
      return;
    }

    // Save the pattern for next time
    browser.storage.local.set({ lastPattern: pattern });

    let regex;
    try {
      if (!/.*\:\/\/.*/.test(pattern) && !pattern.startsWith("*")) {
        pattern = "*://" + pattern;
      }

      regex = patternToRegExp(pattern);
    } catch (e) {
      messageDiv.textContent = `Invalid pattern syntax: ${e.message}`;
      messageDiv.style.color = "red";
      updateCloseButtonState(0);
      return;
    }

    messageDiv.textContent = "Searching for tabs...";
    messageDiv.style.color = "#555";

    try {
      const tabs = await browser.tabs.query({});
      const matchingTabsFullInfo = [];

      for (const tab of tabs) {
        if (tab.url && !tab.pinned) {
          if (regex.test(tab.url)) {
            matchingTabsFullInfo.push(tab);
            currentMatchingTabIds.push(tab.id);
          }
        }
      }

      if (matchingTabsFullInfo.length > 0) {
        tabListContainer.style.display = "block";
        tabCountDiv.textContent =
          `Total matching tabs: ${matchingTabsFullInfo.length}`;
        messageDiv.textContent = "";

        // Display first 3 tabs
        for (let i = 0; i < Math.min(3, matchingTabsFullInfo.length); i++) {
          const tab = matchingTabsFullInfo[i];
          const listItem = document.createElement("li");
          const favicon = tab.favIconUrl
            ? `<img src="${tab.favIconUrl}" width="16" height="16" style="vertical-align: middle; margin-right: 5px;">`
            : "";
          listItem.innerHTML = `${favicon}${tab.title || tab.url}`;
          listItem.title = tab.url;
          matchingTabsList.appendChild(listItem);
        }
        if (matchingTabsFullInfo.length > 3) {
          const moreItem = document.createElement("li");
          moreItem.textContent = `... and ${
            matchingTabsFullInfo.length - 3
          } more tabs`;
          moreItem.style.fontStyle = "italic";
          matchingTabsList.appendChild(moreItem);
        }
        updateCloseButtonState(matchingTabsFullInfo.length);
      } else {
        messageDiv.textContent =
          "No matching tabs found for this pattern. Pattern: " + pattern;
        messageDiv.style.color = "#555";
        updateCloseButtonState(0);
      }
    } catch (error) {
      console.error("Error searching tabs for preview:", error);
      messageDiv.textContent = `Error during search: ${error.message}`;
      messageDiv.style.color = "red";
      clearTabPreview();
      updateCloseButtonState(0);
    }
  }

  function clearTabPreview() {
    tabListContainer.style.display = "none";
    tabCountDiv.textContent = "";
    matchingTabsList.innerHTML = "";
  }

  function updateCloseButtonState(count) {
    if (count > 0) {
      closeTabsButton.textContent = `Close Matching Tabs (${count})`;
      closeTabsButton.classList.remove("button-disabled");
      closeTabsButton.disabled = false;
    } else {
      closeTabsButton.textContent = "Close Matching Tabs (0)";
      closeTabsButton.classList.add("button-disabled");
      closeTabsButton.disabled = true;
    }
  }

  updateCloseButtonState(0);
});

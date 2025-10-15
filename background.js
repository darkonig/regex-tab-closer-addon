// Listen for messages from the popup script
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "closeTabs") {
    browser.tabs.remove(message.tabIds).catch((error) => {
      console.error("Error closing tabs:", error);
    });
  } else if (message.action === "moveTabs") {
    return moveTabsToNewWindow(message.tabIds);
  } else if (message.action === "exportUrls") {
    return collectAndOpenGroupedHtml(message.groupType);
  } else if (message.action === "goToTab") {
    const tabId = message.tabId;

    try {
      const tab = await browser.tabs.get(tabId);

      await browser.windows.update(tab.windowId, { focused: true });

      await browser.tabs.update(tabId, { active: true });
    } catch (error) {
      console.error("Failed to go to tab:", error);
    }
  }
});

// Function to move tabs to a new window
async function moveTabsToNewWindow(tabIds) {
  try {
    // Create a new window. It will contain one blank tab.
    const newWindow = await browser.windows.create();
    const newWindowId = newWindow.id;

    // Move the specified tabs to the new window
    await browser.tabs.move(tabIds, {
      windowId: newWindowId,
      index: -1, // Move to the end of the new window
    });

    // Query for the initial blank tab in the new window
    const blankTabs = await browser.tabs.query({
      windowId: newWindowId,
      url: "about:blank",
    });

    // If the blank tab exists, remove it
    if (blankTabs.length > 0) {
      await browser.tabs.remove(blankTabs[0].id);
    }

    // Focus the new window after tabs are moved
    await browser.windows.update(newWindowId, {
      focused: true,
    });

    return { success: true };
  } catch (error) {
    console.error("Error in background script while moving tabs:", error);

    return { success: false, error: error.message };
  }
}

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

// function csvEscape(text) {
//   if (!text) return '""';
//   // Replace all double-quotes with two double-quotes, then wrap the whole string in double-quotes
//   return `"${String(text).replace(/"/g, '""')}"`;
// }
// async function exportAllUrlsToCsv() {
//   try {
//     const tabs = await browser.tabs.query({});
//     const currentDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
//
//     // 1. Define the CSV header row (Removed "Day Opened")
//     let csvContent = "Title,URL,Index,Last Accessed\n";
//
//     // 2. Format the data rows
//     const dataRows = tabs
//       .map((tab) => {
//         const title = csvEscape(tab.title);
//         const url = csvEscape(tab.url);
//         const index = tab.index;
//         const lastAccessedFormatted = formatTimestamp(tab.lastAccessed);
//
//         return `${title},${url},${index},${lastAccessedFormatted}`;
//       })
//       .join("\n");
//
//     csvContent += dataRows;
//
//     // 3. Create a Blob with the text/csv MIME type
//     const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
//     const url = URL.createObjectURL(blob);
//
//     // 4. Initiate the download
//     await browser.downloads.download({
//       url: url,
//       filename: `Firefox_Tab_Export_${currentDate}.csv`,
//       saveAs: true,
//     });
//
//     URL.revokeObjectURL(url);
//
//     return { success: true };
//   } catch (error) {
//     console.error("Error during URL export:", error);
//     return { success: false, error: error.message };
//   }
// }

function getDomain(url) {
  try {
    const urlObject = new URL(url);
    const hostname = urlObject.hostname;

    // Handle local files or non-standard URLs
    if (!hostname || hostname.includes(":") || hostname.includes("about:")) {
      return "Other / Local";
    }

    const segments = hostname.split(".");
    const numSegments = segments.length;

    // Take the last 3 segments (TLD, SLD, and one more level)
    const startIndex = Math.max(0, numSegments - 3);

    // If segments are like ['google', 'com'], it will take both (2)
    // If segments are like ['www', 'sub', 'google', 'com'], it will take ['sub', 'google', 'com'] (3)
    const domainSegments = segments.slice(startIndex);

    return domainSegments.join(".");
  } catch (e) {
    return "Invalid or Local File";
  }
}

async function collectAndOpenGroupedHtml(groupType) {
  try {
    const tabs = await browser.tabs.query({});
    const groupedTabs = {};
    let title;

    // Prepare simplified tab data
    const simpleTabs = tabs.map((tab) => ({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      index: tab.index,
      windowId: tab.windowId,
      lastAccessed: tab.lastAccessed || Date.now(),
    }));

    if (groupType === "date") {
      title = "All Open Tabs Grouped by Last Accessed Date";
      // Group by date (YYYY-MM-DD)
      simpleTabs.forEach((tab) => {
        const dateStr = formatTimestamp(tab.lastAccessed).substring(0, 10);
        if (!groupedTabs[dateStr]) groupedTabs[dateStr] = [];
        groupedTabs[dateStr].push(tab);
      });
    } else if (groupType === "domain") {
      title = "All Open Tabs Grouped by Domain Name";
      // Group by domain name
      simpleTabs.forEach((tab) => {
        const domainStr = getDomain(tab.url);
        if (!groupedTabs[domainStr]) groupedTabs[domainStr] = [];
        groupedTabs[domainStr].push(tab);
      });
    } else {
      throw new Error("Invalid grouping type specified.");
    }

    // Store the grouped data and type in local storage
    await browser.storage.local.set({
      groupedTabData: groupedTabs,
      groupingTitle: title,
      groupType: groupType,
    });

    // Open the results page in a new tab
    await browser.tabs.create({ url: browser.runtime.getURL("results.html") });

    return { success: true };
  } catch (error) {
    console.error("Error during tab data collection:", error);
    return { success: false, error: error.message };
  }
}

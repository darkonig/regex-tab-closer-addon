// Listen for messages from the popup script
browser.runtime.onMessage.addListener((message) => {
  if (message.action === "closeTabs") {
    console.error("not implemented");
    // browser.tabs.remove(message.tabIds).catch((error) => {
    //   console.error("Error closing tabs:", error);
    // });
  } else if (message.action === "moveTabs") {
    moveTabsToNewWindow(message.tabIds);
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
  } catch (error) {
    console.error("Error in background script while moving tabs:", error);
  }
}

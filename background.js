/**
 * TabCur - Advanced Tab Manager
 * background.js - Background service worker for tab management
 */

// Default settings
const DEFAULT_SETTINGS = {
  autoGroupEnabled: true,
  recentTabsCount: 2,
  theme: 'system',
  userGroups: []
};

// Tab history for navigation
let tabHistory = [];
// Recent tabs for visual indicators
let recentTabs = [];
// Cache for tab data
let tabsCache = {};

/**
 * Initialize the extension
 */
async function initialize() {
  // Load or set default settings
  const settings = await loadSettings();

  // Get all current tabs to initialize the cache
  const tabs = await chrome.tabs.query({});
  tabs.forEach(tab => {
    tabsCache[tab.id] = tab;
  });

  // Set up tab event listeners
  setupEventListeners();

  // Store initial state in storage for the popup
  try {
    await chrome.storage.local.set({
      recentTabs,
      tabHistory
    });
  } catch (error) {
    console.error('Error saving initial state to storage:', error);
  }

  console.log('TabCur extension initialized');
}

/**
 * Load settings from storage or set defaults
 */
async function loadSettings() {
  try {
    const data = await chrome.storage.local.get('settings');
    if (data.settings) {
      return data.settings;
    } else {
      await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
      return DEFAULT_SETTINGS;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save settings to storage
 */
async function saveSettings(settings) {
  try {
    await chrome.storage.local.set({ settings });
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

/**
 * Set up event listeners for tab events
 */
function setupEventListeners() {
  // Tab activation (when user switches tabs)
  chrome.tabs.onActivated.addListener(activeInfo => {
    // Use a non-blocking approach to avoid potential issues
    handleTabActivated(activeInfo.tabId, activeInfo.windowId).catch(error => {
      console.error('Error handling tab activation:', error);
    });
  });

  // Tab creation
  chrome.tabs.onCreated.addListener(tab => {
    tabsCache[tab.id] = tab;
    handleNewTab(tab);
  });

  // Tab update (URL changes, etc.)
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    tabsCache[tabId] = tab;
    if (changeInfo.url) {
      handleTabUrlChanged(tabId, tab);
    }
  });

  // Tab removal
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    delete tabsCache[tabId];
    await removeFromHistory(tabId);
    await removeFromRecent(tabId);
  });

  // Commands (keyboard shortcuts)
  chrome.commands.onCommand.addListener(command => {
    if (command === 'navigate-to-previous-tab') {
      navigateToPreviousTab();
    }
  });
}

/**
 * Handle tab activation (when user switches tabs)
 */
async function handleTabActivated(tabId, windowId) {
  // Add to tab history
  await addToHistory(tabId);

  // Update recent tabs
  await updateRecentTabs(tabId);

  const tab = tabsCache[tabId];
  if (!tab || !tab.url) return;

  // Get settings
  const settings = await loadSettings();
  const userGroups = settings.userGroups || [];

  // Check if the tab is already in a group
  if (tab.groupId && tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
    try {
      // Get the current group info
      const group = await chrome.tabGroups.get(tab.groupId);

      // Check if this group matches any user-defined group
      const isUserGroup = userGroups.some(userGroup => userGroup.name === group.title);

      // If it's a user-defined group, don't change it
      if (isUserGroup) {
        return;
      }
    } catch (error) {
      console.log('Error checking existing group:', error);
    }
  }

  // If not in a user group, check for user group matches first
  const matchesUserGroup = await checkAndApplyUserGrouping(tab);

  // Only apply auto grouping if no user group match and auto-grouping is enabled
  if (!matchesUserGroup && settings.autoGroupEnabled) {
    await checkAndApplyAutoGrouping(tab);
  }
}

/**
 * Handle new tab creation
 */
async function handleNewTab(tab) {
  // We don't do anything with empty tabs
  if (!tab.url || tab.url === 'chrome://newtab/') {
    return;
  }

  // Get settings to check if auto-grouping is enabled
  const settings = await loadSettings();
  if (settings.autoGroupEnabled) {
    await checkAndApplyAutoGrouping(tab);
  }

  // Check if tab matches any user-defined group keywords
  await checkAndApplyUserGrouping(tab);
}

/**
 * Handle tab URL changes
 */
async function handleTabUrlChanged(tabId, tab) {
  // Get settings to check if auto-grouping is enabled
  const settings = await loadSettings();

  // Check for auto grouping
  if (settings.autoGroupEnabled) {
    await checkAndApplyAutoGrouping(tab);
  }

  // Check for user-defined grouping
  await checkAndApplyUserGrouping(tab);
}

/**
 * Add a tab to the navigation history
 */
async function addToHistory(tabId) {
  // Remove this tab if it's already in history
  removeFromHistory(tabId);

  // Add to the front of the history
  tabHistory.unshift(tabId);

  // Keep history at a reasonable size
  if (tabHistory.length > 50) {
    tabHistory.pop();
  }

  // Store tab history in storage for the popup to access
  try {
    await chrome.storage.local.set({ tabHistory });
  } catch (error) {
    console.error('Error saving tab history to storage:', error);
  }
}

/**
 * Remove a tab from the navigation history
 */
async function removeFromHistory(tabId) {
  tabHistory = tabHistory.filter(id => id !== tabId);

  // Update storage
  try {
    await chrome.storage.local.set({ tabHistory });
  } catch (error) {
    console.error('Error saving tab history to storage:', error);
  }
}

/**
 * Update the list of recent tabs
 */
async function updateRecentTabs(tabId) {
  // Remove this tab if it's already in recent list
  removeFromRecent(tabId);

  // Add to the front of the recent tabs
  recentTabs.unshift(tabId);
  console.log('Added tab to recent tabs:', tabId);

  // Get settings to check how many recent tabs to track
  const settings = await loadSettings();
  const count = settings.recentTabsCount || 2;  // Default to 2 if not set
  console.log('Recent tabs count setting:', count);

  // Keep recent tabs at the specified size
  if (recentTabs.length > count) {
    recentTabs = recentTabs.slice(0, count);
  }
  console.log('Current recent tabs:', recentTabs);

  // Store recent tabs in storage for the popup to access
  try {
    await chrome.storage.local.set({ recentTabs });
    console.log('Saved recent tabs to storage');
  } catch (error) {
    console.error('Error saving recent tabs to storage:', error);
  }
}

/**
 * Remove a tab from the recent tabs list
 */
async function removeFromRecent(tabId) {
  recentTabs = recentTabs.filter(id => id !== tabId);

  // Update storage
  try {
    await chrome.storage.local.set({ recentTabs });
  } catch (error) {
    console.error('Error saving recent tabs to storage:', error);
  }
}

/**
 * Navigate to the previous tab in history
 */
async function navigateToPreviousTab() {
  // Get tab history from storage
  let history = [];
  try {
    const data = await chrome.storage.local.get('tabHistory');
    history = data.tabHistory || [];
  } catch (error) {
    console.error('Error loading tab history from storage:', error);
    return;
  }

  // Need at least 2 tabs in history to navigate back
  if (history.length < 2) {
    return;
  }

  // Get the previous tab (index 1, since index 0 is current)
  const previousTabId = history[1];

  // Check if the tab still exists
  try {
    const tab = await chrome.tabs.get(previousTabId);
    if (tab) {
      // Activate the previous tab
      await chrome.tabs.update(previousTabId, { active: true });

      // If the tab is in a different window, focus that window
      if (tab.windowId) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
    }
  } catch (error) {
    // Tab doesn't exist anymore, remove it from history
    await removeFromHistory(previousTabId);
    // Try again with the next tab
    navigateToPreviousTab();
  }
}

/**
 * Extract domain parts from a URL
 */
function getDomainParts(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Remove 'www.' if present
    const domain = hostname.startsWith('www.') ? hostname.slice(4) : hostname;

    // Split the domain into parts
    return domain.split('.');
  } catch (error) {
    console.error('Error parsing URL:', error);
    return [];
  }
}

/**
 * Check if a domain has a country code TLD
 * This is a simplified check - in a real extension you might want a more comprehensive list
 */
function hasCountryCodeTLD(domainParts) {
  if (domainParts.length < 2) return false;

  const tld = domainParts[domainParts.length - 1];
  // Common country code TLDs (this is not exhaustive)
  const countryCodes = ['uk', 'us', 'ca', 'au', 'de', 'fr', 'jp', 'cn', 'ru', 'br', 'in', 'il'];

  return countryCodes.includes(tld.toLowerCase()) && tld.length <= 3;
}

/**
 * Get group name for a tab based on its URL
 */
function getAutoGroupName(tab) {
  if (!tab.url || tab.url.startsWith('chrome://')) {
    return 'Chrome';
  }

  const domainParts = getDomainParts(tab.url);

  if (domainParts.length === 0) {
    return 'Other';
  }

  // Check if it has a country code TLD
  if (hasCountryCodeTLD(domainParts)) {
    // For country-specific domains, group by last 3 domain parts
    if (domainParts.length >= 3) {
      return domainParts.slice(-3).join('.');
    }
  }

  // For regular domains, group by last 2 domain parts
  if (domainParts.length >= 2) {
    return domainParts.slice(-2).join('.');
  }

  // Fallback
  return domainParts.join('.');
}

/**
 * Attempt to perform a tab grouping operation with retry logic
 */
async function attemptTabGroupOperation(operation, maxRetries = 3, delay = 500) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // If this is a "tabs cannot be edited" error, wait and retry
      if (error.message && error.message.includes("Tabs cannot be edited")) {
        console.log(`Tab grouping failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        // Increase delay for next attempt
        delay *= 1.5;
      } else {
        // For other errors, don't retry
        throw error;
      }
    }
  }

  // If we've exhausted all retries
  console.warn(`Failed to perform tab grouping after ${maxRetries} attempts:`, lastError);
  throw lastError;
}

/**
 * Check if a tab should be auto-grouped based on its domain
 */
async function checkAndApplyAutoGrouping(tab) {
  // Skip empty tabs, chrome pages, and extension pages
  if (!tab.url || tab.url === 'chrome://newtab/' || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    return;
  }

  const groupName = getAutoGroupName(tab);

  // Check if tab is already in a group
  if (tab.groupId && tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
    try {
      // Get the current group info
      const group = await chrome.tabGroups.get(tab.groupId);

      // If the group name matches, no need to change anything
      if (group.title === groupName) {
        return;
      }
    } catch (error) {
      // Group might not exist anymore, continue with grouping
      console.log('Error checking existing group, continuing with grouping:', error);
    }
  }

  try {
    // Find existing groups with this name in the same window
    const groups = await chrome.tabGroups.query({ title: groupName, windowId: tab.windowId });

    if (groups.length > 0) {
      // Add to existing group in the same window with retry logic
      await attemptTabGroupOperation(async () => {
        await chrome.tabs.group({ tabIds: [tab.id], groupId: groups[0].id });
      });
    } else {
      // Create a new group with retry logic
      const groupId = await attemptTabGroupOperation(async () => {
        return await chrome.tabs.group({ tabIds: [tab.id] });
      });

      // Set the group title and color with retry logic
      await attemptTabGroupOperation(async () => {
        await chrome.tabGroups.update(groupId, {
          title: groupName,
          color: getColorForDomain(groupName)
        });
      });
    }
  } catch (error) {
    console.error('Failed to apply auto grouping:', error);
    // Don't rethrow - we want to fail gracefully
  }
}

/**
 * Check if a tab matches any user-defined group keywords and apply grouping
 * @returns {Promise<boolean>} Returns true if a match was found and grouping was applied
 */
async function checkAndApplyUserGrouping(tab) {
  // Skip empty tabs, chrome pages, and extension pages
  if (!tab.url || tab.url === 'chrome://newtab/' || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    return false;
  }

  // Get user-defined groups
  const settings = await loadSettings();
  const userGroups = settings.userGroups || [];

  // Check each group for keyword matches
  for (const group of userGroups) {
    if (!group.keywords || group.keywords.length === 0) {
      continue;
    }

    const keywords = Array.isArray(group.keywords) ? group.keywords : group.keywords.split(',').map(k => k.trim());

    // Check if any keyword matches the tab URL
    const matches = keywords.some(keyword => {
      return keyword && tab.url.toLowerCase().includes(keyword.toLowerCase());
    });

    if (matches) {
      try {
        // Find existing groups with this name in the same window
        const groups = await chrome.tabGroups.query({ title: group.name, windowId: tab.windowId });

        if (groups.length > 0) {
          // Add to existing group in the same window with retry logic
          await attemptTabGroupOperation(async () => {
            await chrome.tabs.group({ tabIds: [tab.id], groupId: groups[0].id });
          });
        } else {
          // Create a new group with retry logic
          const groupId = await attemptTabGroupOperation(async () => {
            return await chrome.tabs.group({ tabIds: [tab.id] });
          });

          // Set the group title and color with retry logic
          await attemptTabGroupOperation(async () => {
            await chrome.tabGroups.update(groupId, {
              title: group.name,
              color: group.color || 'blue'
            });
          });
        }
        return true; // Successfully applied grouping
      } catch (error) {
        console.error('Failed to apply user grouping:', error);
        // Continue to the next group
        continue;
      }
    }
  }

  return false; // No matches found
}

/**
 * Get a consistent color for a domain
 */
function getColorForDomain(domain) {
  // Available colors in Chrome
  const colors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'];

  // Simple hash function to get a consistent color for the same domain
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Get a color from the hash
  const colorIndex = Math.abs(hash) % colors.length;
  return colors[colorIndex];
}

// Initialize the extension when the service worker starts
initialize();
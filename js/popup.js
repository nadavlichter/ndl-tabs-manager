/**
 * TabCur - Advanced Tab Manager
 * popup.js - Handles the popup UI interactions
 */

// DOM Elements
const tabsList = document.getElementById('tabs-list');
const groupsList = document.getElementById('groups-list');
const searchInput = document.getElementById('search-tabs');
const clearSearchBtn = document.getElementById('clear-search');
const autoGroupToggle = document.getElementById('auto-group-toggle');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const closeSettingsBtn = document.getElementById('close-settings');
const recentTabsCountSelect = document.getElementById('recent-tabs-count');
const themeOptions = document.querySelectorAll('.theme-option');
const addGroupBtn = document.getElementById('add-group-btn');
const addGroupModal = document.getElementById('add-group-modal');
const closeModalBtn = document.getElementById('close-modal');
const backBtn = document.getElementById('back-btn');
const saveGroupBtn = document.getElementById('save-group');
const deleteGroupBtn = document.getElementById('delete-group');
const groupModalTitle = document.getElementById('group-modal-title');
const groupIdInput = document.getElementById('group-id');
const groupNameInput = document.getElementById('group-name');
const groupKeywordsInput = document.getElementById('group-keywords');
const colorOptions = document.querySelectorAll('.color-option');

// State
let settings = null;
let allTabs = [];
let filteredTabs = [];
let selectedColor = 'blue';
let editingGroupId = null;

/**
 * Initialize the popup
 */
async function initialize() {
  console.log('Initializing popup');

  // Check if DOM elements are properly initialized
  console.log('addGroupBtn:', addGroupBtn);
  console.log('addGroupModal:', addGroupModal);

  // Load settings
  settings = await loadSettings();

  // Apply theme
  applyTheme(settings.theme);

  // Set up UI based on settings
  autoGroupToggle.checked = settings.autoGroupEnabled;
  recentTabsCountSelect.value = settings.recentTabsCount;

  // Set active theme option
  themeOptions.forEach(option => {
    if (option.dataset.theme === settings.theme) {
      option.classList.add('active');
    } else {
      option.classList.remove('active');
    }
  });

  // Load tabs
  await loadTabs();

  // Load user groups
  loadUserGroups();

  // Set up event listeners
  setupEventListeners();

  console.log('Popup initialization complete');
}

/**
 * Load settings from storage
 */
async function loadSettings() {
  try {
    const data = await chrome.storage.local.get('settings');
    if (data.settings) {
      return data.settings;
    } else {
      // Default settings
      const defaultSettings = {
        autoGroupEnabled: true,
        recentTabsCount: 3,
        theme: 'system',
        userGroups: []
      };
      await chrome.storage.local.set({ settings: defaultSettings });
      return defaultSettings;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    return {
      autoGroupEnabled: true,
      recentTabsCount: 3,
      theme: 'system',
      userGroups: []
    };
  }
}

/**
 * Save settings to storage
 */
async function saveSettings() {
  try {
    await chrome.storage.local.set({ settings });
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

/**
 * Apply theme based on setting
 */
function applyTheme(theme) {
  if (theme === 'system') {
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

/**
 * Load all tabs from Chrome
 */
async function loadTabs() {
  try {
    // Get all tabs from all windows
    allTabs = await chrome.tabs.query({});

    // Try to get recent tabs from storage instead of background page
    let recentTabs = [];
    try {
      const data = await chrome.storage.local.get('recentTabs');
      recentTabs = data.recentTabs || [];
    } catch (storageError) {
      console.warn('Could not load recent tabs from storage:', storageError);
    }

    // Mark recent tabs
    allTabs.forEach(tab => {
      const recentIndex = recentTabs.indexOf(tab.id);
      if (recentIndex !== -1 && recentIndex < 3) {
        tab.recentIndex = recentIndex + 1;
      }
    });

    // Initial display with all tabs
    filteredTabs = [...allTabs];
    displayTabs(filteredTabs);
  } catch (error) {
    console.error('Error loading tabs:', error);
    displayError('Failed to load tabs. Please try again.');
  }
}

/**
 * Display tabs in the UI, grouped by their tab groups
 */
function displayTabs(tabs) {
  // Clear the tabs list
  tabsList.innerHTML = '';

  // Group tabs by their groupId
  const tabGroups = {};
  const ungroupedTabs = [];

  tabs.forEach(tab => {
    if (tab.groupId && tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      if (!tabGroups[tab.groupId]) {
        tabGroups[tab.groupId] = [];
      }
      tabGroups[tab.groupId].push(tab);
    } else {
      ungroupedTabs.push(tab);
    }
  });

  // Get group details for all group IDs
  const groupIds = Object.keys(tabGroups);
  if (groupIds.length > 0) {
    chrome.tabGroups.query({}, groups => {
      // Create a map of group details
      const groupDetails = {};
      groups.forEach(group => {
        groupDetails[group.id] = group;
      });

      // Display grouped tabs
      for (const groupId in tabGroups) {
        const group = groupDetails[groupId] || { title: 'Unknown Group', color: 'grey' };
        displayTabGroup(group, tabGroups[groupId]);
      }

      // Display ungrouped tabs
      if (ungroupedTabs.length > 0) {
        displayUngroupedTabs(ungroupedTabs);
      }
    });
  } else {
    // Only ungrouped tabs
    if (ungroupedTabs.length > 0) {
      displayUngroupedTabs(ungroupedTabs);
    } else {
      tabsList.innerHTML = '<div class="empty-state">No tabs match your search</div>';
    }
  }
}

/**
 * Extract domain from a URL
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    console.error('Error extracting domain:', e);
    return url; // Return the original URL if parsing fails
  }
}

/**
 * Sort tabs by domain
 */
function sortTabsByDomain(tabs) {
  return [...tabs].sort((a, b) => {
    const domainA = extractDomain(a.url);
    const domainB = extractDomain(b.url);

    // First sort by domain
    if (domainA !== domainB) {
      return domainA.localeCompare(domainB);
    }

    // If domains are the same, sort by path
    const pathA = new URL(a.url).pathname;
    const pathB = new URL(b.url).pathname;
    return pathA.localeCompare(pathB);
  });
}

/**
 * Display a group of tabs
 */
function displayTabGroup(group, tabs) {
  const groupElement = document.createElement('div');
  groupElement.className = 'tab-group';
  groupElement.innerHTML = `
    <div class="tab-group-header">
      <div class="tab-group-title">
        <div class="tab-group-color" style="background-color: ${getColorValue(group.color)}"></div>
        <span>${group.title || 'Unnamed Group'}</span>
      </div>
      <div class="tab-group-count">${tabs.length} tab${tabs.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="tab-group-content"></div>
  `;

  const contentElement = groupElement.querySelector('.tab-group-content');

  // Sort tabs by domain
  const sortedTabs = sortTabsByDomain(tabs);

  // Add tabs to the group
  sortedTabs.forEach(tab => {
    const tabElement = createTabElement(tab);
    contentElement.appendChild(tabElement);
  });

  // Add click handler for expanding/collapsing
  const headerElement = groupElement.querySelector('.tab-group-header');
  headerElement.addEventListener('click', () => {
    groupElement.classList.toggle('expanded');
  });

  tabsList.appendChild(groupElement);
}

/**
 * Display ungrouped tabs
 */
function displayUngroupedTabs(tabs) {
  const groupElement = document.createElement('div');
  groupElement.className = 'tab-group';
  groupElement.innerHTML = `
    <div class="tab-group-header">
      <div class="tab-group-title">
        <span>Ungrouped Tabs</span>
      </div>
      <div class="tab-group-count">${tabs.length} tab${tabs.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="tab-group-content"></div>
  `;

  const contentElement = groupElement.querySelector('.tab-group-content');

  // Sort tabs by domain
  const sortedTabs = sortTabsByDomain(tabs);

  // Add tabs to the group
  sortedTabs.forEach(tab => {
    const tabElement = createTabElement(tab);
    contentElement.appendChild(tabElement);
  });

  // Add click handler for expanding/collapsing
  const headerElement = groupElement.querySelector('.tab-group-header');
  headerElement.addEventListener('click', () => {
    groupElement.classList.toggle('expanded');
  });

  tabsList.appendChild(groupElement);
}

/**
 * Create a tab element
 */
function createTabElement(tab) {
  const tabElement = document.createElement('div');
  tabElement.className = 'tab-item';

  // Add recent tab indicator class if applicable
  if (tab.recentIndex) {
    tabElement.classList.add(`recent-${tab.recentIndex}`);
  }

  tabElement.innerHTML = `
    <img class="tab-favicon" src="${tab.favIconUrl || 'icons/default-favicon.png'}" alt="">
    <div class="tab-title">${tab.title}</div>
  `;

  // Add click handler to activate the tab
  tabElement.addEventListener('click', () => {
    chrome.tabs.update(tab.id, { active: true });
    chrome.windows.update(tab.windowId, { focused: true });
    window.close(); // Close the popup
  });

  return tabElement;
}

/**
 * Load user-defined groups
 */
function loadUserGroups() {
  // Clear the groups list
  groupsList.innerHTML = '';

  // Get user groups from settings
  const userGroups = settings.userGroups || [];

  if (userGroups.length === 0) {
    groupsList.innerHTML = '<div class="empty-state">No custom groups defined</div>';
    return;
  }

  // Display each group
  userGroups.forEach(group => {
    const groupElement = document.createElement('div');
    groupElement.className = 'group-item';
    groupElement.dataset.id = group.id;

    groupElement.innerHTML = `
      <div class="group-item-info">
        <div class="group-item-color" style="background-color: ${getColorValue(group.color)}"></div>
        <div class="group-item-name">${group.name}</div>
      </div>
      <div class="group-item-keywords">${formatKeywords(group.keywords)}</div>
    `;

    // Add click handler to edit the group
    groupElement.addEventListener('click', () => {
      openEditGroupModal(group);
    });

    groupsList.appendChild(groupElement);
  });
}

/**
 * Format keywords for display
 */
function formatKeywords(keywords) {
  if (!keywords) return '';

  const keywordArray = Array.isArray(keywords) ? keywords : keywords.split(',').map(k => k.trim());
  if (keywordArray.length === 0) return '';

  if (keywordArray.length === 1) {
    return keywordArray[0];
  }

  return `${keywordArray.length} keywords`;
}

/**
 * Get CSS color value from Chrome color name
 */
function getColorValue(colorName) {
  const colorMap = {
    'grey': '#9AA0A6',
    'blue': '#8AB4F8',
    'red': '#F28B82',
    'yellow': '#FDD663',
    'green': '#81C995',
    'pink': '#F8BBD0',
    'purple': '#D7AEFB',
    'cyan': '#78D9EC'
  };

  return colorMap[colorName] || colorMap.grey;
}

/**
 * Filter tabs based on search input
 */
function filterTabs(searchText) {
  if (!searchText) {
    filteredTabs = [...allTabs];
  } else {
    const lowerSearch = searchText.toLowerCase();
    filteredTabs = allTabs.filter(tab => {
      return tab.title.toLowerCase().includes(lowerSearch) ||
             tab.url.toLowerCase().includes(lowerSearch);
    });
  }

  displayTabs(filteredTabs);
}

/**
 * Open the add group modal
 */
function openAddGroupModal() {
  console.log('Opening add group modal');

  // Reset form
  groupModalTitle.textContent = 'Add New Group';
  groupIdInput.value = '';
  groupNameInput.value = '';
  groupKeywordsInput.value = '';
  deleteGroupBtn.classList.add('hidden');

  // Reset color selection
  selectedColor = 'blue';
  colorOptions.forEach(option => {
    if (option.dataset.color === selectedColor) {
      option.classList.add('selected');
    } else {
      option.classList.remove('selected');
    }
  });

  // Show modal
  console.log('Before: Modal classes:', addGroupModal.className);
  addGroupModal.style.display = 'flex';
  addGroupModal.classList.add('visible');
  console.log('After: Modal classes:', addGroupModal.className);

  groupNameInput.focus();
}

// Make the function globally accessible
window.openAddGroupModal = openAddGroupModal;

/**
 * Open the edit group modal
 */
function openEditGroupModal(group) {
  // Set form values
  groupModalTitle.textContent = 'Edit Group';
  groupIdInput.value = group.id;
  groupNameInput.value = group.name;
  groupKeywordsInput.value = Array.isArray(group.keywords) ? group.keywords.join(', ') : group.keywords;
  deleteGroupBtn.classList.remove('hidden');

  // Set color selection
  selectedColor = group.color || 'blue';
  colorOptions.forEach(option => {
    if (option.dataset.color === selectedColor) {
      option.classList.add('selected');
    } else {
      option.classList.remove('selected');
    }
  });

  // Show modal
  addGroupModal.style.display = 'flex';
  addGroupModal.classList.add('visible');
  groupNameInput.focus();
}

/**
 * Close the group modal
 */
function closeGroupModal() {
  console.log('Closing modal');
  addGroupModal.classList.remove('visible');
  addGroupModal.style.display = 'none';
}

/**
 * Save a group
 */
function saveGroup() {
  console.log('Saving group');
  const id = groupIdInput.value || Date.now().toString();
  const name = groupNameInput.value.trim();
  const keywords = groupKeywordsInput.value.trim();

  if (!name) {
    alert('Please enter a group name');
    return;
  }

  // Create or update group
  const group = {
    id,
    name,
    color: selectedColor,
    keywords: keywords.split(',').map(k => k.trim()).filter(k => k)
  };

  console.log('Group data:', group);

  // Update settings
  if (!settings.userGroups) {
    settings.userGroups = [];
  }

  const existingIndex = settings.userGroups.findIndex(g => g.id === id);
  if (existingIndex !== -1) {
    settings.userGroups[existingIndex] = group;
  } else {
    settings.userGroups.push(group);
  }

  // Save settings
  saveSettings();
  console.log('Settings saved, userGroups:', settings.userGroups);

  // Reload groups
  loadUserGroups();

  // Close modal
  closeGroupModal();
}

/**
 * Delete a group
 */
function deleteGroup() {
  const id = groupIdInput.value;
  if (!id) return;

  // Confirm deletion
  if (!confirm('Are you sure you want to delete this group?')) {
    return;
  }

  // Remove from settings
  settings.userGroups = settings.userGroups.filter(g => g.id !== id);

  // Save settings
  saveSettings();

  // Reload groups
  loadUserGroups();

  // Close modal
  closeGroupModal();
}

/**
 * Toggle settings panel
 */
function toggleSettingsPanel() {
  settingsPanel.classList.toggle('visible');
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Search input
  searchInput.addEventListener('input', () => {
    filterTabs(searchInput.value);
  });

  // Clear search
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    filterTabs('');
  });

  // Previous tab button
  const prevTabBtn = document.getElementById('prev-tab-btn');
  if (prevTabBtn) {
    prevTabBtn.addEventListener('click', () => {
      navigateToPreviousTab();
    });
  }

  // Auto group toggle
  autoGroupToggle.addEventListener('change', () => {
    settings.autoGroupEnabled = autoGroupToggle.checked;
    saveSettings();
  });

  // Settings button
  settingsBtn.addEventListener('click', toggleSettingsPanel);

  // Close settings button
  closeSettingsBtn.addEventListener('click', toggleSettingsPanel);

  // Recent tabs count select
  recentTabsCountSelect.addEventListener('change', () => {
    settings.recentTabsCount = parseInt(recentTabsCountSelect.value);
    saveSettings();
  });

  // Theme options
  themeOptions.forEach(option => {
    option.addEventListener('click', () => {
      // Update active class
      themeOptions.forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');

      // Update settings
      settings.theme = option.dataset.theme;
      saveSettings();

      // Apply theme
      applyTheme(settings.theme);
    });
  });

  // Add group button
  addGroupBtn.addEventListener('click', () => {
    console.log('Add group button clicked');
    openAddGroupModal();
  });

  // Close modal button
  closeModalBtn.addEventListener('click', closeGroupModal);

  // Back button
  const backBtn = document.getElementById('back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', closeGroupModal);
  }

  // Save group button
  saveGroupBtn.addEventListener('click', saveGroup);

  // Delete group button
  deleteGroupBtn.addEventListener('click', deleteGroup);

  // Color options
  colorOptions.forEach(option => {
    option.addEventListener('click', () => {
      // Update selected class
      colorOptions.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');

      // Update selected color
      selectedColor = option.dataset.color;
    });
  });

  // Close modal when clicking outside
  addGroupModal.addEventListener('click', event => {
    if (event.target === addGroupModal) {
      closeGroupModal();
    }
  });

  // Listen for system theme changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (settings.theme === 'system') {
        applyTheme('system');
      }
    });
  }
}

/**
 * Display an error message
 */
function displayError(message) {
  tabsList.innerHTML = `<div class="error-message">${message}</div>`;
}

/**
 * Navigate to the previous tab
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

      // Close the popup
      window.close();
    }
  } catch (error) {
    console.error('Error navigating to previous tab:', error);
  }
}

// Initialize the popup when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded');
  initialize();

  // Add a direct event listener to the add group button
  const addGroupBtnDirect = document.getElementById('add-group-btn');
  if (addGroupBtnDirect) {
    console.log('Found add group button directly:', addGroupBtnDirect);
    addGroupBtnDirect.addEventListener('click', (e) => {
      console.log('Add group button clicked directly');
      e.stopPropagation();
      openAddGroupModal();
    });
  } else {
    console.error('Could not find add group button directly');
  }
});
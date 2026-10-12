/** IPC channel names shared by main, preloads and renderer. */
export const IPC = {
  // UI renderer -> main
  getSnapshot: 'ui:get-snapshot',
  setGear: 'ui:set-gear',
  patchVehicle: 'ui:patch-vehicle',
  patchSettings: 'ui:patch-settings',
  setBrowserLayout: 'ui:set-browser-layout',
  addBookmark: 'ui:add-bookmark',
  removeBookmark: 'ui:remove-bookmark',
  clearBrowsingData: 'ui:clear-browsing-data',
  openGuestDevTools: 'ui:open-guest-devtools',
  answerPermission: 'ui:answer-permission',
  // main -> UI renderer
  vehicleChanged: 'main:vehicle-changed',
  settingsChanged: 'main:settings-changed',
  bookmarksChanged: 'main:bookmarks-changed',
  historyChanged: 'main:history-changed',
  guardrailEvent: 'main:guardrail-event',
  guestMetrics: 'main:guest-metrics',
  permissionRequest: 'main:permission-request',
  guestNavigate: 'main:guest-navigate',
  forceCollapse: 'main:force-collapse',
  // guest frames <-> main
  guestInitialState: 'guest:initial-state',
  guestGear: 'guest:gear',
  guestReport: 'guest:report',
  guestMetricsReport: 'guest:metrics'
} as const

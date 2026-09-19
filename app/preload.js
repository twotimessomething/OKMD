const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('okmd', {
  // actions
  save: (content, saveAs) => ipcRenderer.invoke('save', { content, saveAs }),
  newDoc: () => ipcRenderer.send('new-doc'),
  openDialog: () => ipcRenderer.send('open-dialog'),
  openRecent: (filePath) => ipcRenderer.send('open-recent', filePath),
  clearRecents: () => ipcRenderer.send('clear-recents'),
  openDropped: (files) => {
    const paths = [];
    for (const file of files) {
      try {
        const p = webUtils.getPathForFile(file);
        if (p) paths.push(p);
      } catch (_) { /* skip anything we can't resolve */ }
    }
    if (paths.length) ipcRenderer.send('open-dropped', paths);
  },
  setDirty: (dirty) => ipcRenderer.send('set-dirty', dirty),
  saveThenCloseResult: (saved) => ipcRenderer.send('save-then-close-result', saved),

  // events
  onRecents: (cb) => ipcRenderer.on('recents', (_e, list) => cb(list)),
  onFileOpened: (cb) => ipcRenderer.on('file-opened', (_e, data) => cb(data)),
  onFileNew: (cb) => ipcRenderer.on('file-new', () => cb()),
  onToggleMode: (cb) => ipcRenderer.on('toggle-mode', () => cb()),
  onToggleSidebar: (cb) => ipcRenderer.on('toggle-sidebar', () => cb()),
  onRequestSave: (cb) => ipcRenderer.on('request-save', (_e, data) => cb(data)),
  onRequestSaveThenClose: (cb) => ipcRenderer.on('request-save-then-close', () => cb())
});

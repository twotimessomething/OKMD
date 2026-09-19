const { app, BrowserWindow, Menu, dialog, ipcMain, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

const isMac = process.platform === 'darwin';
const FILTERS = [
  { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] },
  { name: 'All Files', extensions: ['*'] }
];

// Every window owns exactly one document. `empty` means the window is still
// showing the start screen, so it can be reused instead of opening another one.
const docs = new Map(); // win.id -> { filePath, dirty, empty }
const docOf = (win) => (win ? docs.get(win.id) : null);
const senderWindow = (e) => BrowserWindow.fromWebContents(e.sender);

let queuedOpen = []; // files handed to us before the app was ready

// ---- Recent files ----
const RECENTS_MAX = 12;
const RECENTS_SHOWN = 6;
let recents = [];

const recentsFile = () => path.join(app.getPath('userData'), 'recents.json');

function loadRecents() {
  try {
    const parsed = JSON.parse(fs.readFileSync(recentsFile(), 'utf8'));
    recents = Array.isArray(parsed) ? parsed.filter(p => typeof p === 'string') : [];
  } catch (_) {
    recents = [];
  }
}

function writeRecents() {
  const target = recentsFile();
  const tmp = target + '.tmp';
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(recents), 'utf8');
    fs.renameSync(tmp, target); // atomic, so a crash can't leave half a file
  } catch (_) { /* not fatal */ }
}

function rememberRecent(filePath) {
  // Re-read first: a second app instance may have written since we last looked,
  // and holding a stale list in memory would clobber its entries.
  loadRecents();
  recents = [filePath, ...recents.filter(p => p !== filePath)].slice(0, RECENTS_MAX);
  writeRecents();
  app.addRecentDocument(filePath);
  sendRecents();
}

// A short, readable location: "~/Documents" or "…/LittleAIProjects/OKMD".
function prettyDir(filePath) {
  const home = app.getPath('home');
  let dir = path.dirname(filePath);
  if (dir === home) return '~';
  if (dir.startsWith(home + path.sep)) dir = '~' + dir.slice(home.length);
  const parts = dir.split(path.sep).filter(Boolean);
  return parts.length > 3 ? '…/' + parts.slice(-2).join('/') : dir;
}

function recentList() {
  return recents
    .filter(p => fs.existsSync(p))
    .slice(0, RECENTS_SHOWN)
    .map(p => ({ path: p, name: path.basename(p), dir: prettyDir(p) }));
}

function sendRecents(win) {
  const list = recentList();
  const targets = win ? [win] : BrowserWindow.getAllWindows();
  targets.forEach(w => { if (!w.isDestroyed()) w.webContents.send('recents', list); });
}

// ---- Windows ----
function createWindow(initial) {
  const from = BrowserWindow.getFocusedWindow();
  const offset = from && !from.isFullScreen() ? from.getBounds() : null;

  const win = new BrowserWindow({
    width: 1000,
    height: 780,
    minWidth: 480,
    minHeight: 360,
    ...(offset ? { x: offset.x + 26, y: offset.y + 26 } : {}),
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    ...(isMac ? { tabbingIdentifier: 'okmd' } : {}),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#262624' : '#faf9f5',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  docs.set(win.id, { filePath: null, dirty: false, empty: true });

  win.loadFile(path.join(__dirname, 'index.html'));
  win.once('ready-to-show', () => win.show());

  win.webContents.on('did-finish-load', () => sendRecents(win));
  win.webContents.once('did-finish-load', () => {
    if (initial && initial.filePath) openInWindow(win, initial.filePath);
    else if (initial && initial.blank) blankInWindow(win);
    else updateTitle(win);
  });

  win.on('close', (e) => {
    const doc = docOf(win);
    if (!doc || !doc.dirty) return;
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: 'Do you want to save the changes you made?',
      detail: "Your changes will be lost if you don't save them."
    });
    if (choice === 2) { e.preventDefault(); return; }
    if (choice === 0) {
      e.preventDefault();
      win.webContents.send('request-save-then-close');
    }
  });

  win.on('closed', () => docs.delete(win.id));
  return win;
}

function updateTitle(win) {
  const doc = docOf(win);
  if (!win || !doc) return;
  win.setTitle(doc.empty ? 'OKMD' : doc.filePath ? path.basename(doc.filePath) : 'Untitled');
  if (isMac) {
    win.setRepresentedFilename(doc.filePath || '');
    win.setDocumentEdited(doc.dirty);
  }
}

// ---- Documents ----
function openInWindow(win, filePath) {
  if (!docOf(win)) return;
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    dialog.showErrorBox('Could not open file', String(err.message || err));
    return;
  }
  Object.assign(docOf(win), { filePath, dirty: false, empty: false });
  updateTitle(win);
  rememberRecent(filePath);
  win.webContents.send('file-opened', { filePath, content });
}

function blankInWindow(win) {
  if (!docOf(win)) return;
  Object.assign(docOf(win), { filePath: null, dirty: false, empty: false });
  updateTitle(win);
  win.webContents.send('file-new');
}

// Reuse `preferred` if it is still on the start screen, otherwise open a window.
function openPath(filePath, preferred) {
  const already = BrowserWindow.getAllWindows().find(w => {
    const doc = docOf(w);
    return doc && doc.filePath === filePath;
  });
  if (already) { already.show(); already.focus(); return; }

  const doc = docOf(preferred);
  if (doc && doc.empty) openInWindow(preferred, filePath);
  else createWindow({ filePath });
}

function newDocument(preferred) {
  const doc = docOf(preferred);
  if (doc && doc.empty) blankInWindow(preferred);
  else createWindow({ blank: true });
}

async function promptOpen(win) {
  const res = await dialog.showOpenDialog(win || undefined, {
    properties: ['openFile', 'multiSelections'],
    filters: FILTERS
  });
  if (res.canceled) return;
  res.filePaths.forEach((p, i) => openPath(p, i === 0 ? win : null));
}

async function saveContent(win, content, saveAs) {
  const doc = docOf(win);
  if (!doc) return { saved: false };
  let target = doc.filePath;
  if (saveAs || !target) {
    const res = await dialog.showSaveDialog(win, {
      defaultPath: target || 'Untitled.md',
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    });
    if (res.canceled || !res.filePath) return { saved: false };
    target = res.filePath;
  }
  try {
    fs.writeFileSync(target, content, 'utf8');
    Object.assign(doc, { filePath: target, dirty: false, empty: false });
    updateTitle(win);
    rememberRecent(target);
    return { saved: true, filePath: target };
  } catch (err) {
    dialog.showErrorBox('Could not save file', String(err.message || err));
    return { saved: false };
  }
}

// ---- IPC ----
ipcMain.handle('save', (e, { content, saveAs }) => saveContent(senderWindow(e), content, !!saveAs));
ipcMain.on('open-dropped', (e, paths) => {
  const win = senderWindow(e);
  paths.forEach((p, i) => openPath(p, i === 0 ? win : null));
});
ipcMain.on('open-dialog', (e) => promptOpen(senderWindow(e)));
ipcMain.on('open-recent', (e, filePath) => openPath(filePath, senderWindow(e)));
ipcMain.on('new-doc', (e) => newDocument(senderWindow(e)));
ipcMain.on('clear-recents', () => {
  recents = [];
  writeRecents();
  app.clearRecentDocuments();
  sendRecents();
});
ipcMain.on('set-dirty', (e, dirty) => {
  const win = senderWindow(e);
  const doc = docOf(win);
  if (!doc) return;
  doc.dirty = !!dirty;
  updateTitle(win);
});
ipcMain.on('save-then-close-result', (e, saved) => {
  const win = senderWindow(e);
  const doc = docOf(win);
  if (saved && doc) { doc.dirty = false; win.close(); }
});

// ---- Menu ----
const onFocused = (fn) => () => fn(BrowserWindow.getFocusedWindow());

function buildMenu() {
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: onFocused(newDocument) },
        { label: 'New Window', accelerator: 'Shift+CmdOrCtrl+N', click: () => createWindow() },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: onFocused(promptOpen) },
        { role: 'recentDocuments', submenu: [{ role: 'clearRecentDocuments' }] },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: onFocused(w => w && w.webContents.send('request-save', { saveAs: false }))
        },
        {
          label: 'Save As…',
          accelerator: 'Shift+CmdOrCtrl+S',
          click: onFocused(w => w && w.webContents.send('request-save', { saveAs: true }))
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Preview / Raw',
          accelerator: 'CmdOrCtrl+E',
          click: onFocused(w => w && w.webContents.send('toggle-mode'))
        },
        {
          label: 'Toggle Outline',
          accelerator: 'Alt+CmdOrCtrl+S',
          click: onFocused(w => w && w.webContents.send('toggle-sidebar'))
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---- App lifecycle ----
app.on('open-file', (e, filePath) => {
  e.preventDefault();
  if (app.isReady()) openPath(filePath, BrowserWindow.getFocusedWindow());
  else queuedOpen.push(filePath);
});

// macOS "+" button in the native tab bar.
app.on('new-window-for-tab', () => {
  const from = BrowserWindow.getFocusedWindow();
  const win = createWindow();
  win.once('ready-to-show', () => {
    try { if (from && !from.isDestroyed()) from.addTabbedWindow(win); } catch (_) { /* stays a window */ }
  });
});

app.whenReady().then(() => {
  loadRecents();
  buildMenu();

  const argFile = process.argv.slice(1)
    .find(a => /\.(md|markdown|mdown|mkd|txt)$/i.test(a) && fs.existsSync(a));
  if (argFile) queuedOpen.push(argFile);

  if (queuedOpen.length) queuedOpen.forEach(p => createWindow({ filePath: p }));
  else createWindow();
  queuedOpen = [];

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => { if (!isMac) app.quit(); });

/* global marked, hljs */
(() => {
  const HL = (window.hljs && window.hljs.default) || window.hljs;
  const M = (window.marked && window.marked.marked) || window.marked;
  const { TurndownService, gfm } = window.TurndownBundle;

  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    hr: '---'
  });
  td.use(gfm);
  td.keep(['del', 'sup', 'sub']);

  const preview = document.getElementById('preview');
  const previewScroll = document.getElementById('preview-scroll');
  const raw = document.getElementById('raw');
  const rawScroll = document.getElementById('raw-scroll');
  const btnPreview = document.getElementById('btn-preview');
  const btnRaw = document.getElementById('btn-raw');
  const filenameEl = document.getElementById('filename');
  const recentsEl = document.getElementById('recents');
  const recentsEmptyEl = document.getElementById('recents-empty');
  const clearRecentsBtn = document.getElementById('clear-recents');

  document.execCommand('defaultParagraphSeparator', false, 'p');

  let view = 'start';   // start | preview | raw
  let mode = 'preview'; // which editor view to return to
  let dirty = false;
  let currentName = '';
  let renderTimer = null;

  // ---- markdown setup ----
  M.setOptions({ gfm: true, breaks: false, highlight: null });

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  M.use({
    renderer: {
      code({ text, lang }) {
        let html;
        const language = (lang || '').trim().split(/\s+/)[0];
        try {
          if (language && HL.getLanguage(language)) {
            html = HL.highlight(text, { language, ignoreIllegals: true }).value;
          } else {
            html = escapeHtml(text);
          }
        } catch (_) {
          html = escapeHtml(text);
        }
        return `<pre><code class="hljs${language ? ` language-${language}` : ''}">${html}</code></pre>`;
      }
    }
  });

  function render() {
    preview.innerHTML = M.parse(raw.value);
    // open links in the default browser instead of navigating the app
    preview.querySelectorAll('a[href]').forEach(a => a.setAttribute('target', '_blank'));
    // make task-list checkboxes clickable, and reflect clicks into the markdown
    preview.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.removeAttribute('disabled');
      cb.addEventListener('change', () => {
        if (cb.checked) cb.setAttribute('checked', ''); else cb.removeAttribute('checked');
        markPreviewEdited();
      });
    });
    previewEdited = false;
  }

  // ---- preview -> markdown sync ----
  let previewEdited = false;
  let syncTimer = null;

  function syncFromPreview() {
    clearTimeout(syncTimer);
    if (!previewEdited) return;
    try {
      raw.value = td.turndown(preview.innerHTML)
        .replace(/^(\s*)- {3}/gm, '$1- ')
        .replace(/^(\s*)(\d+)\. {2}/gm, '$1$2. ');
      previewEdited = false;
    } catch (_) { /* keep last known markdown */ }
  }

  function markPreviewEdited() {
    previewEdited = true;
    setDirty(true);
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncFromPreview, 400);
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 120);
  }

  // ---- views ----
  function setView(next) {
    if (next === 'preview') render();
    else if (view === 'preview') syncFromPreview();

    view = next;
    if (next !== 'start') mode = next;
    document.body.dataset.view = next;
    btnPreview.classList.toggle('active', next === 'preview');
    btnRaw.classList.toggle('active', next === 'raw');
    if (next === 'raw') raw.focus({ preventScroll: true });
  }

  function toggleMode() {
    if (view === 'start') return;
    setView(view === 'preview' ? 'raw' : 'preview');
  }

  btnPreview.addEventListener('click', () => setView('preview'));
  btnRaw.addEventListener('click', () => setView('raw'));
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      toggleMode();
    }
  });

  // ---- editing / dirty state ----
  function setDirty(d) {
    if (dirty === d) return;
    dirty = d;
    window.okmd.setDirty(d);
    updateFilename();
  }
  function updateFilename() {
    filenameEl.textContent = (currentName || 'Untitled') + (dirty ? ' — Edited' : '');
  }

  raw.addEventListener('input', () => {
    setDirty(true);
    scheduleRender();
  });
  preview.addEventListener('input', () => markPreviewEdited());

  // Tab inserts two spaces in the editor
  raw.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = raw.selectionStart, end = raw.selectionEnd;
      raw.setRangeText('  ', start, end, 'end');
      raw.dispatchEvent(new Event('input'));
    }
  });

  // ---- start screen ----
  document.getElementById('start-new').addEventListener('click', () => window.okmd.newDoc());
  document.getElementById('start-open').addEventListener('click', () => window.okmd.openDialog());
  clearRecentsBtn.addEventListener('click', () => window.okmd.clearRecents());

  window.okmd.onRecents((list) => {
    recentsEl.replaceChildren(...list.map(item => {
      const btn = document.createElement('button');
      btn.className = 'recent';
      btn.title = `${item.dir}/${item.name}`;

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = item.name;

      const dir = document.createElement('span');
      dir.className = 'dir';
      dir.textContent = item.dir;

      btn.append(name, dir);
      btn.addEventListener('click', () => window.okmd.openRecent(item.path));

      const li = document.createElement('li');
      li.append(btn);
      return li;
    }));
    recentsEmptyEl.hidden = list.length > 0;
    clearRecentsBtn.hidden = list.length === 0;
  });

  // ---- file plumbing ----
  window.okmd.onFileOpened(({ filePath, content }) => {
    raw.value = content;
    currentName = filePath.split('/').pop();
    dirty = false;
    updateFilename();
    setView('preview');
    previewScroll.scrollTop = 0;
    rawScroll.scrollTop = 0;
  });

  window.okmd.onFileNew(() => {
    raw.value = '';
    currentName = '';
    dirty = false;
    updateFilename();
    setView('raw');
  });

  window.okmd.onToggleMode(() => toggleMode());

  window.okmd.onRequestSave(async ({ saveAs }) => {
    if (view === 'start') return;
    syncFromPreview();
    const res = await window.okmd.save(raw.value, saveAs);
    if (res && res.saved) {
      dirty = false;
      if (res.filePath) currentName = res.filePath.split('/').pop();
      updateFilename();
    }
  });

  window.okmd.onRequestSaveThenClose(async () => {
    syncFromPreview();
    const res = await window.okmd.save(raw.value, false);
    window.okmd.saveThenCloseResult(!!(res && res.saved));
  });

  // ---- drag & drop ----
  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragDepth++;
    document.body.classList.add('dragging');
  });
  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) document.body.classList.remove('dragging');
  });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    document.body.classList.remove('dragging');
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) window.okmd.openDropped(files);
  });

  updateFilename();
})();

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
  const sidebarBtn = document.getElementById('btn-sidebar');
  const outlineEl = document.getElementById('outline');
  const outlineEmptyEl = document.getElementById('outline-empty');

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
    syncTimer = setTimeout(() => { syncFromPreview(); buildOutline(); }, 400);
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => { render(); buildOutline(); }, 120);
  }

  // ---- outline ----
  // Each view answers for its own sections: the preview knows where its heading
  // elements sit, the editor knows which source line each one is on. Neither has
  // to guess at the other's positions.
  const SIDEBAR_KEY = 'okmd.sidebar';
  let outline = [];
  let activeSection = -1;
  // A section you jumped to keeps its highlight until you scroll for yourself:
  // the last sections of a document can never reach the top edge, so the spy
  // below would otherwise hand the highlight straight back to an earlier one.
  let pinned = -1;
  let sidebarOpen = store(SIDEBAR_KEY) !== '0';

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (_) { /* preference just doesn't persist */ }
    return null;
  }

  function setSidebar(open) {
    sidebarOpen = open;
    document.body.dataset.sidebar = open ? 'open' : 'closed';
    sidebarBtn.setAttribute('aria-expanded', String(open));
    store(SIDEBAR_KEY, open ? '1' : '0');
    // Opening onto a long document should land on where the reader already is.
    if (open && outlineEl.children[activeSection]) {
      outlineEl.children[activeSection].scrollIntoView({ block: 'nearest' });
    }
  }

  // Headings as rendered — exactly the sections the reader can see. Only
  // top-level ones: a heading nested in a quote or a list isn't a section.
  function outlineFromPreview() {
    return Array.from(preview.children)
      .filter(el => /^H[1-6]$/.test(el.tagName))
      .map(el => ({ level: +el.tagName[1], text: el.textContent.trim(), el }));
  }

  // Headings from the markdown source. Fenced blocks are skipped so a
  // "# comment" inside one never reads as a section.
  function outlineFromSource(text) {
    const lines = text.split('\n');
    const items = [];
    let fence = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const f = line.match(/^ {0,3}(```|~~~)/);
      if (f) {
        if (!fence) fence = f[1];
        else if (f[1] === fence) fence = '';
        continue;
      }
      if (fence) continue;

      const atx = line.match(/^ {0,3}(#{1,6})\s+(.*?)\s*#*$/);
      if (atx) { items.push({ level: atx[1].length, text: atx[2].trim(), line: i }); continue; }

      // Setext: a title with a run of = or - beneath it.
      const above = i > 0 ? lines[i - 1] : '';
      if (/^ {0,3}(=+|-+)\s*$/.test(line) && above.trim() && !/^ {0,3}([#>]|[-*+] )/.test(above)) {
        items.push({ level: line.trim()[0] === '=' ? 1 : 2, text: above.trim(), line: i - 1 });
      }
    }
    return items;
  }

  function buildOutline() {
    outline = (view === 'raw' ? outlineFromSource(raw.value) : outlineFromPreview())
      .filter(item => item.text);

    outlineEl.replaceChildren(...outline.map((item, i) => {
      const btn = document.createElement('button');
      btn.className = 'toc';
      btn.dataset.lvl = item.level;
      btn.style.setProperty('--lvl', item.level);
      btn.textContent = item.text;
      btn.title = item.text;
      btn.addEventListener('click', () => goToSection(i));
      return btn;
    }));
    outlineEmptyEl.hidden = outline.length > 0;

    activeSection = -1;
    pinned = -1;
    if (view === 'preview') syncActiveSection();
  }

  function setActiveSection(i) {
    if (i === activeSection) return;
    const items = outlineEl.children;
    if (items[activeSection]) items[activeSection].classList.remove('active');
    activeSection = i;
    if (!items[i]) return;
    items[i].classList.add('active');
    if (sidebarOpen) items[i].scrollIntoView({ block: 'nearest' });
  }

  // The section you are reading is the last one to have passed the top edge —
  // or the first, while you are still above it.
  function syncActiveSection() {
    if (pinned >= 0) return;
    const top = previewScroll.scrollTop + 28;
    let i = outline.length ? 0 : -1;
    while (i + 1 < outline.length && outline[i + 1].el.offsetTop <= top) i++;
    setActiveSection(i);
  }

  // A textarea won't say where a line of its text sits, so measure it: lay the
  // text up to that point out again in a hidden copy of the editor and ask the
  // marker at the end of it. Soft wrapping is reproduced along with everything
  // else, so the answer holds for wrapped lines too.
  const MIRRORED = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
                    'whiteSpace', 'overflowWrap', 'wordBreak', 'tabSize', 'textIndent',
                    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];

  function rawLineTop(offset) {
    const style = getComputedStyle(raw);
    const mirror = document.createElement('div');
    MIRRORED.forEach(prop => { mirror.style[prop] = style[prop]; });
    // clientWidth, not the computed width: it is the padding box whatever the
    // box-sizing, and it already excludes any scrollbar.
    mirror.style.cssText += ';position:absolute;left:-99999px;top:0;visibility:hidden;' +
                            'box-sizing:border-box;height:auto;width:' + raw.clientWidth + 'px;';
    const marker = document.createElement('span');
    mirror.append(raw.value.slice(0, offset), marker);
    document.body.appendChild(mirror);
    const top = marker.offsetTop;
    mirror.remove();
    return top;
  }

  function goToSection(i) {
    const item = outline[i];
    if (!item) return;
    setActiveSection(i);
    if (item.el) {
      pinned = i;
      previewScroll.scrollTo({ top: Math.max(0, item.el.offsetTop - 20), behavior: 'smooth' });
      return;
    }
    const offset = raw.value.split('\n', item.line).reduce((n, l) => n + l.length + 1, 0);
    raw.focus({ preventScroll: true });
    raw.setSelectionRange(offset, offset);
    raw.scrollTop = Math.max(0, rawLineTop(offset) - 20);
  }

  const unpin = () => { pinned = -1; };
  previewScroll.addEventListener('wheel', unpin, { passive: true });
  previewScroll.addEventListener('mousedown', unpin);
  window.addEventListener('keydown', unpin);

  let spying = false;
  previewScroll.addEventListener('scroll', () => {
    if (spying || view !== 'preview') return;
    spying = true;
    requestAnimationFrame(() => { spying = false; syncActiveSection(); });
  });

  sidebarBtn.addEventListener('click', () => setSidebar(!sidebarOpen));

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
    buildOutline();
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

  // ---- copying out of the preview ----
  // Markdown source is usually hard-wrapped, and inside a code block those
  // wraps survive as real newlines — so copied prose pastes as a column of
  // stubs. Flow those blocks back into whole lines on the way to the
  // clipboard. Tagged code blocks, and anything that doesn't read as
  // hard-wrapped prose, are copied exactly as they are.
  const CODE_CHARS = /[{};=<>|\\`$]/;
  const CODE_TAIL = /[;{}[\]()<>=|&\\]$/;
  const CODE_HEAD = /^[}\])<>|&.]/;
  const BLOCK_HEAD = /^([-*+•>#]|\d+[.)])(\s|$)/;

  // A line carries on from the one above it unless something says otherwise.
  function isContinuation(line) {
    if (!line.trim()) return false;               // blank: a real break
    if (/^\s/.test(line)) return false;           // indented: structure, not flow
    if (BLOCK_HEAD.test(line) || CODE_HEAD.test(line)) return false;
    if (line === line.toUpperCase() && /[A-Z]/.test(line)) return false;  // heading
    return true;
  }

  // Prose someone wrapped by hand, or actual code? Long lines that keep
  // arriving at roughly the same width, few code punctuation marks, and
  // sentence-length lines all point at prose.
  function looksHardWrapped(lines, width) {
    if (width < 50) return false;
    const body = lines.filter(l => l.trim());
    if (body.length < 3) return false;
    if (lines.filter(l => l.length >= width * 0.66).length < 3) return false;
    if (body.filter(l => CODE_CHARS.test(l)).length / body.length >= 0.25) return false;
    const words = body.reduce((n, l) => n + l.trim().split(/\s+/).length, 0);
    return words / body.length >= 6;
  }

  function unwrapHardWraps(text) {
    const lines = text.replace(/\n+$/, '').split('\n').map(l => l.replace(/\s+$/, ''));
    const width = lines.reduce((w, l) => Math.max(w, l.length), 0);
    if (!looksHardWrapped(lines, width)) return text;
    const full = width * 0.66;  // this long: the line ran out of room, not out of sentence

    const out = [];
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      while (i + 1 < lines.length && lines[i].length >= full &&
             !CODE_TAIL.test(lines[i]) && isContinuation(lines[i + 1])) {
        line += ' ' + lines[++i].trim();
      }
      out.push(line);
    }
    return out.join('\n') + (text.endsWith('\n') ? '\n' : '');
  }

  function unwrapPre(pre) {
    const code = pre.querySelector('code') || pre;
    if (/\blanguage-/.test(code.className)) return false;  // declared a language: real code
    const text = code.textContent;
    const flowed = unwrapHardWraps(text);
    if (flowed === text) return false;
    code.textContent = flowed;
    return true;
  }

  document.addEventListener('copy', (e) => {
    if (view !== 'preview') return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!preview.contains(range.commonAncestorContainer)) return;

    const holder = document.createElement('div');
    holder.appendChild(range.cloneContents());

    // A selection sitting wholly inside one block comes back without its
    // <pre>; put it back so the block is treated like any other.
    const node = range.commonAncestorContainer;
    const el = node.nodeType === 1 ? node : node.parentElement;
    const inPre = el && el.closest('pre');
    if (inPre && !holder.querySelector('pre')) {
      const pre = inPre.cloneNode(false);
      const code = document.createElement('code');
      const src = inPre.querySelector('code');
      if (src) code.className = src.className;
      code.append(...holder.childNodes);
      pre.appendChild(code);
      holder.replaceChildren(pre);
    }

    let flowed = false;
    holder.querySelectorAll('pre').forEach(pre => { flowed = unwrapPre(pre) || flowed; });
    if (!flowed) return;  // nothing to flow — let the browser copy as usual

    // innerText needs layout, so read it back from an off-screen copy.
    holder.style.cssText = 'position:fixed;left:-99999px;top:0;pointer-events:none;';
    document.body.appendChild(holder);
    const text = holder.innerText;
    const html = holder.innerHTML;
    holder.remove();

    e.preventDefault();
    e.clipboardData.setData('text/plain', text);
    e.clipboardData.setData('text/html', html);
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
  window.okmd.onToggleSidebar(() => setSidebar(!sidebarOpen));

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

  setSidebar(sidebarOpen);
  buildOutline();
  updateFilename();
})();

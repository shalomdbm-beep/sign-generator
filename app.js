// Sign Generator App — v2
(function() {
  'use strict';

  // ============================================================
  // Constants
  // ============================================================
  const PAGE_SIZES = {
    A4:     { w: 210, h: 297 },
    A3:     { w: 297, h: 420 },
    Letter: { w: 216, h: 279 },
  };

  const MM_TO_PT = 2.83465;          // 1 mm = 2.83465 pt
  const STORAGE_KEY = 'signGenState';
  const DEFAULT_SIGNS = [
    'חליפות גיזרה רגילה',
    'חליפות גיזרה רגילה',
    'חליפות גיזרה צרה',
    'חליפות גיזרה צרה',
    'מכנסי נוער  2=150\nמידות 9-14',
    'כל החליפות 350 ש"ח',
  ];

  // Hidden canvas for precise text measurement
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');

  // ============================================================
  // DOM refs
  // ============================================================
  const els = {
    pageSize:     document.getElementById('pageSize'),
    orientation:  document.getElementById('orientation'),
    signsPerPage: document.getElementById('signsPerPage'),
    fontFamily:   document.getElementById('fontFamily'),
    fontSize:     document.getElementById('fontSize'),
    fontWeight:   document.getElementById('fontWeight'),
    textColor:    document.getElementById('textColor'),
    bgColor:      document.getElementById('bgColor'),
    showBorders:  document.getElementById('showBorders'),
    signsList:    document.getElementById('signsList'),
    addSign:      document.getElementById('addSign'),
    clearAll:     document.getElementById('clearAll'),
    printBtn:     document.getElementById('printBtn'),
    previewPage:  document.getElementById('previewPage'),
  };

  // ============================================================
  // State (loaded from storage or defaults)
  // ============================================================
  let state = loadState();

  function defaultState() {
    return {
      signs: [...DEFAULT_SIGNS],
      pageSize: 'A4',
      orientation: 'portrait',
      signsPerPage: '6',
      fontFamily: 'Arial',
      fontSize: 'auto',
      fontWeight: '700',
      textColor: '#000000',
      bgColor: '#ffffff',
      showBorders: true,
    };
  }

  // ============================================================
  // Persistent storage — save & load
  // ============================================================
  // Safe storage wrapper (may be blocked in sandboxed iframes)
  const _ls = (function() {
    try { const s = window['local' + 'Storage']; s.setItem('_t','1'); s.removeItem('_t'); return s; }
    catch(e) { return null; }
  })();
  const storage = {
    get(key) { try { return _ls && _ls.getItem(key); } catch(e) { return null; } },
    set(key, val) { try { _ls && _ls.setItem(key, val); } catch(e) {} }
  };

  function saveState() {
    state.signs = signs;
    state.pageSize = els.pageSize.value;
    state.orientation = els.orientation.value;
    state.signsPerPage = els.signsPerPage.value;
    state.fontFamily = els.fontFamily.value;
    state.fontSize = els.fontSize.value;
    state.fontWeight = els.fontWeight.value;
    state.textColor = els.textColor.value;
    state.bgColor = els.bgColor.value;
    state.showBorders = els.showBorders.checked;
    storage.set(STORAGE_KEY, JSON.stringify(state));
  }

  function loadState() {
    try {
      const raw = storage.get(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.signs)) return parsed;
      }
    } catch(e) { /* corrupt data — ignore */ }
    return defaultState();
  }

  function applyStateToUI() {
    els.pageSize.value     = state.pageSize     || 'A4';
    els.orientation.value  = state.orientation  || 'portrait';
    els.signsPerPage.value = state.signsPerPage || '6';
    els.fontFamily.value   = state.fontFamily   || 'Arial';
    els.fontSize.value     = state.fontSize     || 'auto';
    els.fontWeight.value   = state.fontWeight   || '700';
    els.textColor.value    = state.textColor    || '#000000';
    els.bgColor.value      = state.bgColor      || '#ffffff';
    els.showBorders.checked = state.showBorders !== false;
  }

  let signs = state.signs;
  let dragIndex = null;

  // ============================================================
  // Precise font-size calculation using canvas.measureText
  // Binary search to find the largest font that fits the box.
  // ============================================================
  function measureTextWidth(text, fontStr) {
    measureCtx.font = fontStr;
    return measureCtx.measureText(text).width;
  }

  /**
   * Find the optimal font size (in px) for `text` to fit within
   * `boxW` x `boxH` pixels, using canvas measurement + binary search.
   * Respects multi-line text (split on \n).
   */
  function calcAutoFontSize(text, boxW, boxH, fontFamily, fontWeight) {
    if (!text) return 16;

    const lines = text.split('\n');
    const numLines = lines.length;
    const longestLine = lines.reduce((a, b) => a.length > b.length ? a : b, '');
    const usableW = boxW * 0.88;    // 12% horizontal padding
    const usableH = boxH * 0.85;    // 15% vertical padding
    const lineHeight = 1.25;

    let lo = 8, hi = 200, best = 12;

    for (let iter = 0; iter < 20; iter++) {
      const mid = (lo + hi) / 2;
      const fontStr = `${fontWeight} ${mid}px ${fontFamily}, Heebo, Arial, sans-serif`;
      const textW = measureTextWidth(longestLine, fontStr);
      const totalH = mid * lineHeight * numLines;

      if (textW <= usableW && totalH <= usableH) {
        best = mid;
        lo = mid + 0.5;
      } else {
        hi = mid - 0.5;
      }
    }

    return Math.max(10, Math.round(best));
  }

  /**
   * Same but returns size in pt, for the print layout.
   * boxW_mm / boxH_mm are in real millimeters.
   */
  function calcAutoFontSizePt(text, boxW_mm, boxH_mm, fontFamily, fontWeight) {
    if (!text) return 12;

    // Convert mm to pt for calculation
    const boxW_pt = boxW_mm * MM_TO_PT;
    const boxH_pt = boxH_mm * MM_TO_PT;

    const lines = text.split('\n');
    const numLines = lines.length;
    const longestLine = lines.reduce((a, b) => a.length > b.length ? a : b, '');
    const usableW = boxW_pt * 0.88;
    const usableH = boxH_pt * 0.85;
    const lineHeight = 1.25;

    // We measure in px on canvas but the ratio is what matters
    let lo = 6, hi = 120, best = 12;

    for (let iter = 0; iter < 20; iter++) {
      const mid = (lo + hi) / 2;
      // Use px for canvas measurement (px ≈ pt on screen at 96dpi)
      const fontStr = `${fontWeight} ${mid}px ${fontFamily}, Heebo, Arial, sans-serif`;
      const textW = measureTextWidth(longestLine, fontStr);
      const totalH = mid * lineHeight * numLines;

      if (textW <= usableW && totalH <= usableH) {
        best = mid;
        lo = mid + 0.5;
      } else {
        hi = mid - 0.5;
      }
    }

    return Math.max(8, Math.round(best));
  }

  // ============================================================
  // Render sign inputs
  // ============================================================
  function renderSignInputs() {
    els.signsList.innerHTML = '';
    signs.forEach((text, i) => {
      const item = document.createElement('div');
      item.className = 'sign-item';
      item.draggable = true;
      item.dataset.index = i;

      item.innerHTML = `
        <span class="drag-handle" title="גרור לשינוי סדר">⠿</span>
        <input type="text" value="${escapeHtml(text.replace(/\n/g, ' / '))}" 
               placeholder="טקסט השלט..." data-index="${i}">
        <button class="remove-btn" data-index="${i}" title="הסר">×</button>
      `;

      // Drag events
      item.addEventListener('dragstart', (e) => {
        dragIndex = i;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        dragIndex = null;
        document.querySelectorAll('.sign-item').forEach(el => el.classList.remove('drag-over'));
      });
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      item.addEventListener('dragenter', () => {
        if (dragIndex !== null && dragIndex !== i) item.classList.add('drag-over');
      });
      item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drag-over');
        if (dragIndex !== null && dragIndex !== i) {
          const moved = signs.splice(dragIndex, 1)[0];
          signs.splice(i, 0, moved);
          renderSignInputs();
          updatePreview();
        }
      });

      els.signsList.appendChild(item);
    });

    // Input change handlers
    els.signsList.querySelectorAll('input[type="text"]').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        signs[idx] = e.target.value.replace(/ \/ /g, '\n');
        updatePreview();
      });
    });

    // Remove handlers
    els.signsList.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.index);
        signs.splice(idx, 1);
        renderSignInputs();
        updatePreview();
      });
    });

    saveState();
  }

  // ============================================================
  // Preview — all sizes derived from mm, then scaled to px
  // ============================================================
  function updatePreview() {
    const sizeKey = els.pageSize.value;
    const size = PAGE_SIZES[sizeKey];
    const isLandscape = els.orientation.value === 'landscape';
    const pageW_mm = isLandscape ? size.h : size.w;
    const pageH_mm = isLandscape ? size.w : size.h;
    const numSigns = parseInt(els.signsPerPage.value);
    const showBorders = els.showBorders.checked;
    const textColor = els.textColor.value;
    const bgColor = els.bgColor.value;
    const fontFamily = els.fontFamily.value;
    const fontWeight = els.fontWeight.value;
    const fontSizeMode = els.fontSize.value;

    // Calculate scale: mm → px
    const wrapper = document.querySelector('.preview-wrapper');
    const isMobile = window.innerWidth <= 960;
    let scale;

    if (isMobile) {
      // Fill width, height follows naturally from A4 ratio
      const wrapperW = wrapper ? wrapper.clientWidth - 20 : 340;
      scale = wrapperW / pageW_mm;
    } else {
      const wrapperW = wrapper ? wrapper.clientWidth - 40 : 500;
      const wrapperH = wrapper ? wrapper.clientHeight - 40 : 700;
      scale = Math.min(wrapperW / pageW_mm, wrapperH / pageH_mm);
    }
    scale = Math.min(scale, 2.8);

    const previewW = pageW_mm * scale;
    const previewH = pageH_mm * scale;
    const signH_mm = pageH_mm / numSigns;
    const signH_px = signH_mm * scale;

    els.previewPage.style.width  = previewW + 'px';
    els.previewPage.style.height = previewH + 'px';
    els.previewPage.style.background = bgColor;
    els.previewPage.innerHTML = '';

    for (let i = 0; i < numSigns; i++) {
      const div = document.createElement('div');
      div.className = 'preview-sign';
      div.style.height = signH_px + 'px';
      div.style.color = textColor;
      div.style.fontFamily = fontFamily + ', Heebo, Arial, sans-serif';
      div.style.fontWeight = fontWeight;

      if (showBorders && i < numSigns - 1) {
        div.style.borderBottom = '1px dashed #aaa';
      }

      const text = signs[i] || '';

      if (fontSizeMode === 'auto') {
        const fs = calcAutoFontSize(text, previewW, signH_px, fontFamily, fontWeight);
        div.style.fontSize = fs + 'px';
      } else {
        // Fixed pt → scale to preview px.  1pt = 1/72 inch = 0.3528mm
        const pt = parseInt(fontSizeMode);
        const mm = pt * 0.3528;
        div.style.fontSize = (mm * scale) + 'px';
      }

      div.textContent = text;
      els.previewPage.appendChild(div);
    }

    saveState();
  }

  // ============================================================
  // Print — sizes in real mm/pt (no pixel guessing)
  // ============================================================
  function handlePrint() {
    const sizeKey = els.pageSize.value;
    const size = PAGE_SIZES[sizeKey];
    const isLandscape = els.orientation.value === 'landscape';
    const pageW_mm = isLandscape ? size.h : size.w;
    const pageH_mm = isLandscape ? size.w : size.h;
    const numSigns = parseInt(els.signsPerPage.value);
    const showBorders = els.showBorders.checked;
    const textColor = els.textColor.value;
    const bgColor = els.bgColor.value;
    const fontFamily = els.fontFamily.value;
    const fontWeight = els.fontWeight.value;
    const fontSizeMode = els.fontSize.value;
    const signH_mm = pageH_mm / numSigns;

    // Remove existing print container
    const existing = document.getElementById('printContainer');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'printContainer';
    container.style.display = 'none';

    // Split signs into pages
    const pages = [];
    for (let i = 0; i < signs.length; i += numSigns) {
      pages.push(signs.slice(i, i + numSigns));
    }
    if (pages.length === 0) pages.push([]);

    pages.forEach((pageSigns) => {
      const page = document.createElement('div');
      page.className = 'print-page';

      for (let i = 0; i < numSigns; i++) {
        const sign = document.createElement('div');
        sign.className = 'print-sign' + (showBorders ? ' with-borders' : '');
        sign.style.color = textColor;
        sign.style.backgroundColor = bgColor;
        sign.style.fontFamily = fontFamily + ', Heebo, Arial, sans-serif';
        sign.style.fontWeight = fontWeight;

        const text = pageSigns[i] || '';

        if (fontSizeMode !== 'auto') {
          sign.style.fontSize = fontSizeMode + 'pt';
        } else {
          // Precise auto-size in pt based on real mm dimensions
          const fs = calcAutoFontSizePt(text, pageW_mm, signH_mm, fontFamily, fontWeight);
          sign.style.fontSize = fs + 'pt';
        }

        sign.textContent = text;
        page.appendChild(sign);
      }

      container.appendChild(page);
    });

    document.body.appendChild(container);

    // Set @page size
    let printStyle = document.getElementById('printPageStyle');
    if (!printStyle) {
      printStyle = document.createElement('style');
      printStyle.id = 'printPageStyle';
      document.head.appendChild(printStyle);
    }
    printStyle.textContent = `@page { size: ${pageW_mm}mm ${pageH_mm}mm; margin: 3mm; }`;

    window.print();
  }

  // ============================================================
  // Event Listeners
  // ============================================================
  [els.pageSize, els.orientation, els.signsPerPage, els.fontFamily,
   els.fontSize, els.fontWeight, els.textColor, els.bgColor, els.showBorders
  ].forEach(el => {
    el.addEventListener('change', updatePreview);
    el.addEventListener('input', updatePreview);
  });

  els.addSign.addEventListener('click', () => {
    signs.push('');
    renderSignInputs();
    updatePreview();
    const inputs = els.signsList.querySelectorAll('input[type="text"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  els.clearAll.addEventListener('click', () => {
    if (signs.length > 0 && !confirm('לנקות את כל השלטים?')) return;
    signs = [];
    renderSignInputs();
    updatePreview();
  });

  els.printBtn.addEventListener('click', handlePrint);

  // ============================================================
  // Helpers
  // ============================================================
  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;');
  }

  // ============================================================
  // Toggle Controls (mobile)
  // ============================================================
  const toggleBtn = document.getElementById('toggleControls');
  const controlsContent = document.getElementById('controlsContent');
  if (toggleBtn && controlsContent) {
    toggleBtn.addEventListener('click', () => {
      const isOpen = controlsContent.classList.toggle('open');
      toggleBtn.classList.toggle('open', isOpen);
    });
  }

  // ============================================================
  // Resize handler
  // ============================================================
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updatePreview, 150);
  });

  // ============================================================
  // Init
  // ============================================================
  applyStateToUI();
  renderSignInputs();
  requestAnimationFrame(() => updatePreview());
})();

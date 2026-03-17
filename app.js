// Sign Generator App
(function() {
  'use strict';

  // Page sizes in mm
  const PAGE_SIZES = {
    A4: { w: 210, h: 297 },
    A3: { w: 297, h: 420 },
    Letter: { w: 216, h: 279 },
  };

  // DOM refs
  const els = {
    pageSize: document.getElementById('pageSize'),
    orientation: document.getElementById('orientation'),
    signsPerPage: document.getElementById('signsPerPage'),
    fontFamily: document.getElementById('fontFamily'),
    fontSize: document.getElementById('fontSize'),
    fontWeight: document.getElementById('fontWeight'),
    textColor: document.getElementById('textColor'),
    bgColor: document.getElementById('bgColor'),
    showBorders: document.getElementById('showBorders'),
    signsList: document.getElementById('signsList'),
    addSign: document.getElementById('addSign'),
    clearAll: document.getElementById('clearAll'),
    printBtn: document.getElementById('printBtn'),
    previewPage: document.getElementById('previewPage'),
  };

  // State
  let signs = [
    'חליפות גיזרה רגילה',
    'חליפות גיזרה רגילה',
    'חליפות גיזרה צרה',
    'חליפות גיזרה צרה',
    'מכנסי נוער  2=150\nמידות 9-14',
    'כל החליפות 350 ש"ח',
  ];

  let dragIndex = null;

  // ---- Render sign inputs ----
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
        if (dragIndex !== null && dragIndex !== i) {
          item.classList.add('drag-over');
        }
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over');
      });

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
        // Convert " / " back to newline
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
  }

  // ---- Preview ----
  function updatePreview() {
    const size = PAGE_SIZES[els.pageSize.value];
    const isLandscape = els.orientation.value === 'landscape';
    const pageW = isLandscape ? size.h : size.w;
    const pageH = isLandscape ? size.w : size.h;
    const numSigns = parseInt(els.signsPerPage.value);
    const showBorders = els.showBorders.checked;
    const textColor = els.textColor.value;
    const bgColor = els.bgColor.value;
    const fontFamily = els.fontFamily.value;
    const fontWeight = els.fontWeight.value;
    const fontSizeMode = els.fontSize.value;

    // Scale preview to fit the available wrapper area
    const wrapper = document.querySelector('.preview-wrapper');
    const isMobile = window.innerWidth <= 960;
    let wrapperW, wrapperH, scale;
    
    if (isMobile) {
      // On mobile: fill width, let height be natural
      wrapperW = wrapper ? wrapper.clientWidth - 24 : 340;
      scale = wrapperW / pageW;
      scale = Math.min(scale, 2.5);
    } else {
      // On desktop: fit within wrapper bounds
      wrapperW = wrapper ? wrapper.clientWidth - 40 : 500;
      wrapperH = wrapper ? wrapper.clientHeight - 40 : 700;
      const scaleX = wrapperW / pageW;
      const scaleY = wrapperH / pageH;
      scale = Math.min(scaleX, scaleY, 2.5);
    }
    
    const previewW = pageW * scale;
    const previewH = pageH * scale;

    els.previewPage.style.width = previewW + 'px';
    els.previewPage.style.height = previewH + 'px';
    els.previewPage.style.background = bgColor;

    const signH = previewH / numSigns;
    
    els.previewPage.innerHTML = '';

    // Show signs up to numSigns, fill rest with empty
    for (let i = 0; i < numSigns; i++) {
      const div = document.createElement('div');
      div.className = 'preview-sign';
      div.style.height = signH + 'px';
      div.style.color = textColor;
      div.style.fontFamily = fontFamily + ', Heebo, Arial, sans-serif';
      div.style.fontWeight = fontWeight;

      if (showBorders && i < numSigns - 1) {
        div.style.borderBottom = '1px dashed #aaa';
      }

      const text = signs[i] || '';
      
      // Auto font size: based on sign height and text length
      if (fontSizeMode === 'auto') {
        const baseSize = signH * 0.4;
        const maxLen = Math.max(...text.split('\n').map(l => l.length), 1);
        const widthConstrained = (previewW * 0.85) / (maxLen * 0.55);
        const hasNewline = text.includes('\n');
        const lineAdjust = hasNewline ? 0.6 : 1;
        const computedSize = Math.min(baseSize * lineAdjust, widthConstrained);
        div.style.fontSize = Math.max(12, Math.min(computedSize, 80)) + 'px';
      } else {
        // Fixed size — scale from pt to preview px
        const ptSize = parseInt(fontSizeMode);
        div.style.fontSize = (ptSize * scale * 0.75) + 'px';
      }

      div.textContent = text;
      els.previewPage.appendChild(div);
    }
  }

  // ---- Print ----
  function handlePrint() {
    const numSigns = parseInt(els.signsPerPage.value);
    const showBorders = els.showBorders.checked;
    const textColor = els.textColor.value;
    const bgColor = els.bgColor.value;
    const fontFamily = els.fontFamily.value;
    const fontWeight = els.fontWeight.value;
    const fontSizeMode = els.fontSize.value;
    const size = PAGE_SIZES[els.pageSize.value];
    const isLandscape = els.orientation.value === 'landscape';

    // Remove existing print container
    const existing = document.getElementById('printContainer');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'printContainer';
    container.style.display = 'none';

    // Split signs into pages
    const totalSigns = signs.length;
    const pages = [];
    for (let i = 0; i < totalSigns; i += numSigns) {
      pages.push(signs.slice(i, i + numSigns));
    }
    // If no signs, make one empty page
    if (pages.length === 0) pages.push([]);

    pages.forEach((pageSigns) => {
      const page = document.createElement('div');
      page.className = 'print-page';
      
      if (isLandscape) {
        page.style.width = size.h + 'mm';
        page.style.height = size.w + 'mm';
      }

      for (let i = 0; i < numSigns; i++) {
        const sign = document.createElement('div');
        sign.className = 'print-sign' + (showBorders ? ' with-borders' : '');
        sign.style.color = textColor;
        sign.style.backgroundColor = bgColor;
        sign.style.fontFamily = fontFamily + ', Heebo, Arial, sans-serif';
        sign.style.fontWeight = fontWeight;

        if (fontSizeMode !== 'auto') {
          sign.style.fontSize = fontSizeMode + 'pt';
        } else {
          // Auto: scale based on number of signs
          const basePt = Math.round(80 / numSigns);
          const text = pageSigns[i] || '';
          const maxLen = Math.max(...text.split('\n').map(l => l.length), 1);
          const adjusted = Math.min(basePt, Math.round(500 / maxLen));
          const hasNewline = text.includes('\n');
          const finalSize = hasNewline ? Math.round(adjusted * 0.65) : adjusted;
          sign.style.fontSize = Math.max(12, Math.min(finalSize, 60)) + 'pt';
        }

        sign.textContent = pageSigns[i] || '';
        page.appendChild(sign);
      }

      container.appendChild(page);
    });

    document.body.appendChild(container);

    // Set page size for print
    let printStyle = document.getElementById('printPageStyle');
    if (!printStyle) {
      printStyle = document.createElement('style');
      printStyle.id = 'printPageStyle';
      document.head.appendChild(printStyle);
    }

    const pw = isLandscape ? size.h : size.w;
    const ph = isLandscape ? size.w : size.h;
    printStyle.textContent = `@page { size: ${pw}mm ${ph}mm; margin: 3mm; }`;

    window.print();
  }

  // ---- Event Listeners ----
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
    // Focus the new input
    const inputs = els.signsList.querySelectorAll('input[type="text"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  els.clearAll.addEventListener('click', () => {
    signs = [];
    renderSignInputs();
    updatePreview();
  });

  els.printBtn.addEventListener('click', handlePrint);

  // ---- Helpers ----
  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;');
  }

  // ---- Toggle Controls (mobile) ----
  const toggleBtn = document.getElementById('toggleControls');
  const controlsContent = document.getElementById('controlsContent');
  if (toggleBtn && controlsContent) {
    toggleBtn.addEventListener('click', () => {
      const isOpen = controlsContent.classList.toggle('open');
      toggleBtn.classList.toggle('open', isOpen);
    });
  }

  // ---- Resize handler ----
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updatePreview, 100);
  });

  // ---- Init ----
  renderSignInputs();
  // Wait a tick for layout to settle
  requestAnimationFrame(() => updatePreview());
})();

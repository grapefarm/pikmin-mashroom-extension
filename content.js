// content.js - 皮克敏網頁可拖曳懸浮香菇掛件

(() => {
  // 避免重複注入
  if (window.__PIKMIN_FLOATING_INJECTED__) return;
  window.__PIKMIN_FLOATING_INJECTED__ = true;

  const COLOR_MAP = {
    red: { icon: '🔴', hex: '#ef4444', name: '紅菇' },
    yellow: { icon: '🟡', hex: '#eab308', name: '黃菇' },
    blue: { icon: '🔵', hex: '#3b82f6', name: '藍菇' },
    white: { icon: '⚪', hex: '#94a3b8', name: '白菇' },
    purple: { icon: '🟣', hex: '#a855f7', name: '紫菇' },
    pink: { icon: '🌸', hex: '#ec4899', name: '粉羽菇' },
    gray: { icon: '🪨', hex: '#64748b', name: '灰岩菇' },
    special: { icon: '✨', hex: '#f59e0b', name: '特殊菇' }
  };

  let hostEl = null;
  let shadow = null;
  let currentMushrooms = [];
  let floatingPositions = {};
  let tickTimer = null;

  // 初始化宿主節點與 Shadow DOM
  function initShadowHost() {
    if (hostEl) return;
    hostEl = document.createElement('div');
    hostEl.id = 'pikmin-floating-root';
    hostEl.style.cssText = 'all: initial; position: absolute; z-index: 2147483647;';
    (document.body || document.documentElement).appendChild(hostEl);
    shadow = hostEl.attachShadow({ mode: 'open' });

    // 注入隔離的 CSS 樣式
    const style = document.createElement('style');
    style.textContent = getShadowStyles();
    shadow.appendChild(style);

    const container = document.createElement('div');
    container.id = 'widgets-container';
    shadow.appendChild(container);
  }

  // Shadow DOM 專用樣式（100% 免疫宿主網頁樣式污染）
  function getShadowStyles() {
    return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        user-select: none;
      }

      #widgets-container {
        --mush-size: 58px;
      }

      .floating-mushroom-widget {
        position: fixed;
        width: var(--mush-size, 58px);
        height: var(--mush-size, 58px);
        cursor: grab;
        z-index: 2147483647;
        transition: transform 0.15s ease, filter 0.2s ease, width 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        background: transparent;
      }

      .pikmin-mushroom-svg {
        width: calc(var(--mush-size, 58px) * 0.93);
        height: calc(var(--mush-size, 58px) * 0.93);
        transition: width 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .floating-mushroom-widget:active {
        cursor: grabbing;
      }

      .floating-mushroom-widget.dragging {
        transform: scale(1.12);
        filter: drop-shadow(0 12px 24px rgba(0,0,0,0.35));
      }

      /* 純香菇懸浮容器 (無框、純透明、自然投影) */
      .mushroom-graphic-wrap {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.35));
        animation: gentleFloat 3s ease-in-out infinite;
        transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.25s ease;
        position: relative;
      }

      .floating-mushroom-widget:hover .mushroom-graphic-wrap {
        transform: scale(1.15) rotate(-3deg);
        filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.45));
      }

      @keyframes gentleFloat {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-5px); }
      }

      .sparkle-star {
        transform-origin: 32px 10px;
        animation: starPulse 1.6s infinite ease-in-out;
      }

      @keyframes starPulse {
        0%, 100% { transform: scale(0.9) rotate(0deg); opacity: 0.8; }
        50% { transform: scale(1.35) rotate(25deg); opacity: 1; }
      }

      .floating-mushroom-widget.completed .mushroom-graphic-wrap {
        animation: bouncePop 1.2s infinite ease-in-out;
      }

      @keyframes bouncePop {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-8px) scale(1.1); }
      }

      /* 迷你狀態指示點 (自然依附在香菇右下側) */
      .mini-badge {
        position: absolute;
        bottom: 3px;
        right: 4px;
        width: calc(var(--mush-size, 58px) * 0.22);
        height: calc(var(--mush-size, 58px) * 0.22);
        min-width: 10px;
        min-height: 10px;
        max-width: 18px;
        max-height: 18px;
        border-radius: 50%;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
      }

      .mini-badge.battling { background: #ef4444; }
      .mini-badge.respawning { background: #10b981; }
      .mini-badge.completed { background: #f59e0b; }

      /* Hover 浮動 HUD 資訊卡片 */
      .hover-hud {
        position: absolute;
        width: 210px;
        background: rgba(255, 255, 255, 0.96);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(226, 232, 240, 0.8);
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        padding: 10px 12px;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: opacity 0.2s ease 0.15s, transform 0.2s ease 0.15s, visibility 0.2s ease 0.15s;
        z-index: 2147483647;
      }

      /* 依位置自動向上或向下展開 */
      .hover-hud.pos-top {
        bottom: calc(var(--mush-size, 58px) + 6px);
        left: 50%;
        transform: translateX(-50%) translateY(6px);
      }

      /* 🌉 隱形安全橋樑 (Invisible Bridge - 填補香菇與面板間的空氣間隙) */
      .hover-hud.pos-top::after {
        content: "";
        position: absolute;
        left: -15px;
        right: -15px;
        bottom: -26px;
        height: 28px;
        background: transparent;
      }

      .hover-hud.pos-bottom {
        top: calc(var(--mush-size, 58px) + 6px);
        left: 50%;
        transform: translateX(-50%) translateY(-6px);
      }

      .hover-hud.pos-bottom::after {
        content: "";
        position: absolute;
        left: -15px;
        right: -15px;
        top: -26px;
        height: 28px;
        background: transparent;
      }

      /* Hover 懸停 或 Click 點擊鎖定 時常駐展開 */
      .floating-mushroom-widget:hover .hover-hud,
      .floating-mushroom-widget.locked .hover-hud {
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        transform: translateX(-50%) translateY(0) !important;
        transition-delay: 0s !important;
      }

      /* 鎖定時香菇帶有細緻的鎖定光暈 */
      .floating-mushroom-widget.locked .mushroom-graphic-wrap {
        transform: scale(1.12) rotate(-2deg);
        filter: drop-shadow(0 0 10px rgba(37, 99, 235, 0.5)) drop-shadow(0 6px 14px rgba(0, 0, 0, 0.4));
      }

      .hud-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }

      .hud-title {
        font-size: 12px;
        font-weight: 700;
        color: #0f172a;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 120px;
      }

      .hud-status-badge {
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 10px;
      }

      .hud-status-badge.battling { background: #fee2e2; color: #dc2626; }
      .hud-status-badge.respawning { background: #dcfce7; color: #166534; }
      .hud-status-badge.completed { background: #fef3c7; color: #b45309; }

      .hud-body {
        margin-bottom: 6px;
      }

      .hud-timer-label {
        font-size: 9px;
        color: #94a3b8;
        text-transform: uppercase;
      }

      .hud-timer-digits {
        font-size: 18px;
        font-weight: 800;
        color: #0f172a;
        font-variant-numeric: tabular-nums;
        line-height: 1.2;
      }

      .hud-timer-digits.respawning { color: #059669; }
      .hud-timer-digits.completed { color: #f59e0b; }

      /* HUD 進度條 */
      .hud-progress-container {
        width: 100%;
        height: 4px;
        background: #f1f5f9;
        border-radius: 2px;
        overflow: hidden;
        margin: 6px 0;
      }

      .hud-progress-bar {
        height: 100%;
        background: #ef4444;
        border-radius: 2px;
        transition: width 0.3s;
      }

      .hud-progress-bar.respawning { background: #10b981; }

      /* HUD 操作按鈕 */
      .hud-actions {
        display: flex;
        justify-content: flex-end;
        gap: 4px;
        margin-top: 6px;
      }

      .hud-btn {
        padding: 3px 6px;
        font-size: 10px;
        border-radius: 4px;
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        color: #475569;
        cursor: pointer;
        transition: all 0.15s;
      }

      .hud-btn:hover {
        background: #e2e8f0;
      }

      .hud-btn.fast-finish {
        background: #f0fdf4;
        color: #166534;
        border-color: #bbf7d0;
        font-weight: 600;
      }

      .hud-btn.fast-finish:hover {
        background: #dcfce7;
      }

      .hud-btn.unpin:hover {
        background: #fee2e2;
        color: #dc2626;
        border-color: #fca5a5;
      }
    `;
  }

  // 動態套用香菇尺寸
  function applyMushroomSize(size) {
    const container = shadow ? shadow.getElementById('widgets-container') : null;
    if (container) {
      container.style.setProperty('--mush-size', `${size || 58}px`);
    }
  }

  // 載入資料並初始化
  async function loadAndSync() {
    initShadowHost();
    const data = await chrome.storage.local.get(['mushrooms', 'floatingPositions', 'mushroomSize']);
    currentMushrooms = data.mushrooms || [];
    floatingPositions = data.floatingPositions || {};
    applyMushroomSize(data.mushroomSize || 58);
    renderWidgets();
  }

  // 渲染所有被釘選的香菇掛件
  function renderWidgets() {
    const container = shadow.getElementById('widgets-container');
    if (!container) return;

    const pinnedMushrooms = currentMushrooms.filter((m) => m.isPinned);

    // 如果沒有釘選任何香菇，清空掛件
    if (pinnedMushrooms.length === 0) {
      container.innerHTML = '';
      return;
    }

    // 移除不在釘選清單裡的舊 DOM
    const existingWidgets = container.querySelectorAll('.floating-mushroom-widget');
    const pinnedIds = new Set(pinnedMushrooms.map((m) => m.id));
    existingWidgets.forEach((w) => {
      if (!pinnedIds.has(w.dataset.id)) {
        w.remove();
      }
    });

    // 建立或更新每個釘選掛件
    pinnedMushrooms.forEach((mush, index) => {
      let widget = container.querySelector(`[data-id="${mush.id}"]`);
      if (!widget) {
        widget = createWidgetElement(mush, index);
        container.appendChild(widget);
        bindDragEvents(widget, mush.id);
      }
      updateWidgetData(widget, mush);
    });

    startTickTimer();
  }

  // 生成高質感立體皮克敏向量香菇 SVG
  function getMushroomSvg(color) {
    const configs = {
      red: { capStart: '#f87171', capEnd: '#dc2626', spot: '#ffffff', glow: '#ef4444' },
      yellow: { capStart: '#fef08a', capEnd: '#eab308', spot: '#ffffff', glow: '#eab308' },
      blue: { capStart: '#60a5fa', capEnd: '#2563eb', spot: '#ffffff', glow: '#3b82f6' },
      white: { capStart: '#ffffff', capEnd: '#cbd5e1', spot: '#f43f5e', glow: '#94a3b8' },
      purple: { capStart: '#c084fc', capEnd: '#7e22ce', spot: '#ffffff', glow: '#a855f7' },
      pink: { capStart: '#f472b6', capEnd: '#db2777', spot: '#ffffff', glow: '#ec4899', isWing: true },
      gray: { capStart: '#94a3b8', capEnd: '#475569', spot: '#cbd5e1', glow: '#64748b', isRock: true },
      special: { capStart: '#fbbf24', capMid: '#f59e0b', capEnd: '#ec4899', spot: '#ffffff', glow: '#f59e0b', isSpecial: true }
    };

    const cfg = configs[color] || configs.red;

    let capGrad = '';
    if (cfg.isSpecial) {
      capGrad = `
        <linearGradient id="cap-grad-special" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fde047" />
          <stop offset="45%" stop-color="#f59e0b" />
          <stop offset="100%" stop-color="#ec4899" />
        </linearGradient>
      `;
    } else {
      capGrad = `
        <radialGradient id="cap-grad-${color}" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stop-color="${cfg.capStart}" />
          <stop offset="100%" stop-color="${cfg.capEnd}" />
        </radialGradient>
      `;
    }

    // 菇頂斑點與特效
    let spots = '';
    if (cfg.isSpecial) {
      spots = `
        <polygon points="20,13 22,17 26,17 23,20 24,24 20,21 16,24 17,20 14,17 18,17" fill="#ffffff" opacity="0.95" />
        <circle cx="11" cy="20" r="2.2" fill="#ffffff" opacity="0.9" />
        <circle cx="29" cy="20" r="2.2" fill="#ffffff" opacity="0.9" />
        <polygon points="32,7 33.5,9.5 36.5,9.5 34,11.5 35,14.5 32,12.5 29,14.5 30,11.5 27.5,9.5 30.5,9.5" fill="#fbbf24" class="sparkle-star" />
      `;
    } else if (cfg.isRock) {
      spots = `
        <polygon points="12,18 19,14 21,22 13,24" fill="#ffffff" opacity="0.35" />
        <polygon points="22,13 29,15 28,23 20,22" fill="#000000" opacity="0.2" />
        <polygon points="15,22 23,21 21,27 14,26" fill="#ffffff" opacity="0.25" />
      `;
    } else {
      spots = `
        <ellipse cx="20" cy="14" rx="3.6" ry="3" fill="${cfg.spot}" opacity="0.95" />
        <ellipse cx="10" cy="20" rx="2.8" ry="3" fill="${cfg.spot}" opacity="0.9" />
        <ellipse cx="30" cy="20" rx="2.8" ry="3" fill="${cfg.spot}" opacity="0.9" />
        <circle cx="15" cy="24" r="1.5" fill="${cfg.spot}" opacity="0.85" />
        <circle cx="25" cy="24" r="1.5" fill="${cfg.spot}" opacity="0.85" />
      `;
    }

    let wings = '';
    if (cfg.isWing) {
      wings = `
        <ellipse cx="6" cy="19" rx="4" ry="7" fill="rgba(255,255,255,0.75)" stroke="#f472b6" stroke-width="0.5" transform="rotate(-25 6 19)" />
        <ellipse cx="34" cy="19" rx="4" ry="7" fill="rgba(255,255,255,0.75)" stroke="#f472b6" stroke-width="0.5" transform="rotate(25 34 19)" />
      `;
    }

    const capFill = cfg.isSpecial ? 'url(#cap-grad-special)' : `url(#cap-grad-${color})`;

    return `
      <svg viewBox="0 0 40 40" class="pikmin-mushroom-svg">
        <defs>
          ${capGrad}
          <linearGradient id="stem-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="100%" stop-color="#fef3c7" />
          </linearGradient>
          <filter id="mush-soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.2" stdDeviation="1" flood-color="#0f172a" flood-opacity="0.25"/>
          </filter>
        </defs>

        ${wings}

        <!-- 菇柄 (圓潤可愛小身軀) -->
        <path d="M 14 20 C 13 29, 12 34, 20 34 C 28 34, 27 29, 26 20 Z" fill="url(#stem-grad)" stroke="#d97706" stroke-width="0.5" stroke-opacity="0.3" />
        
        <!-- 萌系黑色眼睛 -->
        <ellipse cx="17.5" cy="27" rx="1.1" ry="1.6" fill="#1e293b" />
        <ellipse cx="22.5" cy="27" rx="1.1" ry="1.6" fill="#1e293b" />
        <circle cx="17.9" cy="26.3" r="0.45" fill="#ffffff" />
        <circle cx="22.9" cy="26.3" r="0.45" fill="#ffffff" />
        
        <!-- 腮紅 -->
        <ellipse cx="15.5" cy="28.2" rx="1.2" ry="0.7" fill="#fca5a5" opacity="0.65" />
        <ellipse cx="24.5" cy="28.2" rx="1.2" ry="0.7" fill="#fca5a5" opacity="0.65" />

        <!-- 圓滾滾香菇傘頂 -->
        <path d="M 5 21 C 5 8, 35 8, 35 21 C 35 24, 31 25, 20 25 C 9 25, 5 24, 5 21 Z" fill="${capFill}" filter="url(#mush-soft-shadow)" />

        <!-- 傘頂斑點 / 星芒裝飾 -->
        ${spots}
      </svg>
    `;
  }

  // 建立掛件 DOM
  function createWidgetElement(mush, index) {
    const widget = document.createElement('div');
    widget.className = 'floating-mushroom-widget';
    widget.dataset.id = mush.id;

    // 取得歷史拖曳位置，預設排在右下角
    const savedPos = floatingPositions[mush.id];
    const defaultRight = 24;
    const defaultBottom = 80 + index * 68;

    if (savedPos && savedPos.x !== undefined && savedPos.y !== undefined) {
      widget.style.left = `${Math.min(window.innerWidth - 60, Math.max(10, savedPos.x))}px`;
      widget.style.top = `${Math.min(window.innerHeight - 60, Math.max(10, savedPos.y))}px`;
    } else {
      widget.style.right = `${defaultRight}px`;
      widget.style.bottom = `${defaultBottom}px`;
    }

    const colorConfig = COLOR_MAP[mush.color] || COLOR_MAP.red;

    widget.innerHTML = `
      <div class="mushroom-graphic-wrap">
        ${getMushroomSvg(mush.color)}
        <div class="mini-badge battling"></div>
      </div>

      <div class="hover-hud pos-top">
        <div class="hud-header">
          <span class="hud-title">${escapeHtml(mush.name)}</span>
          <span class="hud-status-badge battling">戰鬥中</span>
        </div>
        <div class="hud-body">
          <div class="hud-timer-label">剩餘時間</div>
          <div class="hud-timer-digits">00:00:00</div>
        </div>
        <div class="hud-progress-container">
          <div class="hud-progress-bar" style="width: 100%;"></div>
        </div>
        <div class="hud-actions">
          <button class="hud-btn fast-finish" title="提前打完，進入重生倒數">⚡ 提前打完</button>
          <button class="hud-btn unpin" title="從畫面取消釘選">📌 取消釘選</button>
        </div>
      </div>
    `;

    // 綁定 HUD 內部按鈕
    widget.querySelector('.fast-finish').addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ action: 'fast_finish', id: mush.id });
    });

    widget.querySelector('.unpin').addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ action: 'toggle_pin', id: mush.id });
    });

    // 根據視窗上下半部自動微調 HUD 彈出方向
    widget.addEventListener('mouseenter', () => {
      const rect = widget.getBoundingClientRect();
      const hud = widget.querySelector('.hover-hud');
      if (rect.top < 150) {
        hud.classList.remove('pos-top');
        hud.classList.add('pos-bottom');
      } else {
        hud.classList.remove('pos-bottom');
        hud.classList.add('pos-top');
      }
    });

    return widget;
  }

  // 更新掛件狀態與倒數
  function updateWidgetData(widget, mush) {
    const now = Date.now();
    let phase = 'battling';
    let remainMs = mush.finishTime - now;
    let totalMs = mush.totalDurationMs || 0;
    let label = '距離打完剩餘';
    let badgeText = '⚔️ 戰鬥中';

    if (mush.status === 'respawning' || (mush.status === 'battling' && remainMs <= 0 && mush.respawnTime > now)) {
      phase = 'respawning';
      remainMs = mush.respawnTime - now;
      totalMs = (mush.respawnMinutes || 5) * 60 * 1000;
      label = '距離重生剩餘';
      badgeText = '🌱 重生中';
    } else if (mush.status === 'completed' || remainMs <= 0) {
      phase = 'completed';
      remainMs = 0;
      label = '狀態';
      badgeText = '🎉 已重生';
    }

    widget.classList.remove('battling', 'respawning', 'completed');
    widget.classList.add(phase);

    const graphicWrap = widget.querySelector('.mushroom-graphic-wrap');
    if (graphicWrap && widget.dataset.color !== mush.color) {
      widget.dataset.color = mush.color;
      graphicWrap.innerHTML = getMushroomSvg(mush.color);
    }

    const miniBadge = widget.querySelector('.mini-badge');
    if (miniBadge) miniBadge.className = `mini-badge ${phase}`;

    const hudBadge = widget.querySelector('.hud-status-badge');
    if (hudBadge) {
      hudBadge.className = `hud-status-badge ${phase}`;
      hudBadge.textContent = badgeText;
    }

    const timerLabel = widget.querySelector('.hud-timer-label');
    if (timerLabel) timerLabel.textContent = label;

    const timerDigits = widget.querySelector('.hud-timer-digits');
    if (timerDigits) {
      timerDigits.className = `hud-timer-digits ${phase}`;
      timerDigits.textContent = formatTime(remainMs);
    }

    const progressBar = widget.querySelector('.hud-progress-bar');
    if (progressBar && totalMs > 0) {
      progressBar.className = `hud-progress-bar ${phase}`;
      const pct = Math.min(100, Math.max(0, (remainMs / totalMs) * 100));
      progressBar.style.width = `${pct}%`;
    }

    const fastFinishBtn = widget.querySelector('.fast-finish');
    if (fastFinishBtn) {
      fastFinishBtn.style.display = phase === 'battling' ? 'inline-block' : 'none';
    }
  }

  // 綁定拖曳功能（含邊界防出界與位置記憶）
  function bindDragEvents(widget, mushId) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialX = 0;
    let initialY = 0;

    widget.addEventListener('mousedown', (e) => {
      // 點擊 HUD 內部不觸發拖曳
      if (e.target.closest('.hover-hud')) return;

      isDragging = false;
      startX = e.clientX;
      startY = e.clientY;

      const rect = widget.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;

      const onMouseMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          isDragging = true;
          widget.classList.add('dragging');

          let newX = initialX + dx;
          let newY = initialY + dy;

          // 邊界防出界
          const maxX = window.innerWidth - widget.offsetWidth - 10;
          const maxY = window.innerHeight - widget.offsetHeight - 10;
          newX = Math.max(10, Math.min(maxX, newX));
          newY = Math.max(10, Math.min(maxY, newY));

          widget.style.left = `${newX}px`;
          widget.style.top = `${newY}px`;
          widget.style.right = 'auto';
          widget.style.bottom = 'auto';
        }
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);

        if (isDragging) {
          widget.classList.remove('dragging');
          const finalRect = widget.getBoundingClientRect();
          floatingPositions[mushId] = { x: finalRect.left, y: finalRect.top };
          chrome.storage.local.set({ floatingPositions });
        } else {
          // 原地放開 -> 點擊香菇！切換鎖定固定狀態
          const wasLocked = widget.classList.contains('locked');
          // 先關閉其他可能被鎖定的香菇面板
          const container = shadow ? shadow.getElementById('widgets-container') : null;
          if (container) {
            container.querySelectorAll('.floating-mushroom-widget.locked').forEach((w) => {
              w.classList.remove('locked');
            });
          }
          if (!wasLocked) {
            widget.classList.add('locked');
          }
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  // 點擊網頁其他地方自動解除鎖定狀態
  document.addEventListener('pointerdown', (e) => {
    const path = e.composedPath ? e.composedPath() : [];
    const container = shadow ? shadow.getElementById('widgets-container') : null;
    if (!container) return;

    container.querySelectorAll('.floating-mushroom-widget.locked').forEach((w) => {
      if (!path.includes(w)) {
        w.classList.remove('locked');
      }
    });
  });

  // 每秒定時刷新掛件的倒數
  function startTickTimer() {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(() => {
      const container = shadow ? shadow.getElementById('widgets-container') : null;
      if (!container) return;

      currentMushrooms.filter((m) => m.isPinned).forEach((mush) => {
        const widget = container.querySelector(`[data-id="${mush.id}"]`);
        if (widget) {
          updateWidgetData(widget, mush);
        }
      });
    }, 1000);
  }

  // 監聽 storage 異動（與 Popup 及 Background 實時同步）
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.mushrooms) {
        currentMushrooms = changes.mushrooms.newValue || [];
        renderWidgets();
      }
      if (changes.floatingPositions) {
        floatingPositions = changes.floatingPositions.newValue || {};
      }
      if (changes.mushroomSize) {
        applyMushroomSize(changes.mushroomSize.newValue);
      }
    }
  });

  // 工具函式
  function formatTime(ms) {
    if (ms <= 0) return '00:00:00';
    const totalSecs = Math.floor(ms / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 頁面載入完成後啟動
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAndSync);
  } else {
    loadAndSync();
  }
})();

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

      .floating-mushroom-widget {
        position: fixed;
        width: 54px;
        height: 54px;
        cursor: grab;
        z-index: 2147483647;
        transition: transform 0.15s ease, filter 0.2s ease;
      }

      .floating-mushroom-widget:active {
        cursor: grabbing;
      }

      .floating-mushroom-widget.dragging {
        transform: scale(1.08);
        filter: drop-shadow(0 10px 20px rgba(0,0,0,0.25));
      }

      /* 蘑菇圓形氣泡 */
      .mushroom-bubble {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.92);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16), 0 0 0 2px rgba(255, 255, 255, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: visible;
        animation: gentleFloat 3s ease-in-out infinite;
      }

      @keyframes gentleFloat {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }

      /* 呼吸光環 */
      .glow-ring {
        position: absolute;
        inset: -3px;
        border-radius: 50%;
        opacity: 0.8;
        pointer-events: none;
        animation: pulseRing 2s infinite ease-out;
      }

      @keyframes pulseRing {
        0% { transform: scale(0.95); opacity: 0.8; }
        50% { transform: scale(1.1); opacity: 0.3; }
        100% { transform: scale(0.95); opacity: 0.8; }
      }

      /* 蘑菇圖示 */
      .mushroom-icon {
        font-size: 26px;
        line-height: 1;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.12));
      }

      .floating-mushroom-widget.completed .mushroom-bubble {
        animation: bouncePop 1.2s infinite ease-in-out;
      }

      @keyframes bouncePop {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-8px) scale(1.1); }
      }

      /* 迷你狀態指示點 */
      .mini-badge {
        position: absolute;
        bottom: 2px;
        right: 2px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2px solid #ffffff;
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
        transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s;
        z-index: 2147483647;
      }

      /* 依位置自動向上或向下展開 */
      .hover-hud.pos-top {
        bottom: 62px;
        left: 50%;
        transform: translateX(-50%) translateY(6px);
      }

      .hover-hud.pos-bottom {
        top: 62px;
        left: 50%;
        transform: translateX(-50%) translateY(-6px);
      }

      .floating-mushroom-widget:hover .hover-hud {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
        transform: translateX(-50%) translateY(0);
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

  // 載入資料並初始化
  async function loadAndSync() {
    initShadowHost();
    const data = await chrome.storage.local.get(['mushrooms', 'floatingPositions']);
    currentMushrooms = data.mushrooms || [];
    floatingPositions = data.floatingPositions || {};
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
      <div class="mushroom-bubble">
        <div class="glow-ring" style="box-shadow: 0 0 12px ${colorConfig.hex};"></div>
        <div class="mushroom-icon">${colorConfig.icon}</div>
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

    widget.className = `floating-mushroom-widget ${phase}`;

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
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

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

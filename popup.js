// popup.js - 皮克敏香菇計時器前端邏輯

let mushrooms = [];
let selectedColor = 'special';
let currentMode = 'duration'; // 'duration' | 'endtime'
let tickInterval = null;

const COLOR_NAMES = {
  red: { label: '紅菇', icon: '🔴', hex: '#ef4444' },
  yellow: { label: '黃菇', icon: '🟡', hex: '#eab308' },
  blue: { label: '藍菇', icon: '🔵', hex: '#3b82f6' },
  white: { label: '白菇', icon: '⚪', hex: '#94a3b8' },
  purple: { label: '紫菇', icon: '🟣', hex: '#a855f7' },
  pink: { label: '粉羽菇', icon: '🌸', hex: '#ec4899' },
  gray: { label: '灰岩菇', icon: '🪨', hex: '#64748b' },
  special: { label: '特殊活動菇', icon: '✨', hex: '#f59e0b' }
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadMushrooms();
  await loadSettings();
  initEventListeners();
  startTick();
});

// 載入與初始化偏好設定
async function loadSettings() {
  const data = await chrome.storage.local.get(['mushroomSize']);
  const size = data.mushroomSize || 58;
  applySizeToUI(size);
}

function applySizeToUI(size) {
  const slider = document.getElementById('mush-size-slider');
  const display = document.getElementById('size-val-display');
  if (slider) slider.value = size;
  if (display) display.textContent = `${size}px`;

  document.querySelectorAll('.preset-size-btn').forEach((btn) => {
    if (parseInt(btn.dataset.size, 10) === size) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// 載入儲存的香菇列表
async function loadMushrooms() {
  const data = await chrome.storage.local.get(['mushrooms']);
  mushrooms = data.mushrooms || [];
  renderMushrooms();
  updateStats();
}

// 儲存香菇列表
async function saveMushrooms() {
  await chrome.storage.local.set({ mushrooms });
  updateStats();
}

// 初始化所有按鈕與事件
function initEventListeners() {
  // 開關設定面板與新增表單
  const toggleBtn = document.getElementById('toggle-add-btn');
  const addForm = document.getElementById('add-form');
  const toggleSettingsBtn = document.getElementById('toggle-settings-btn');
  const settingsSection = document.getElementById('settings-section');

  toggleSettingsBtn.addEventListener('click', () => {
    settingsSection.classList.toggle('open');
    const isOpen = settingsSection.classList.contains('open');
    toggleSettingsBtn.classList.toggle('active', isOpen);
    if (isOpen) {
      addForm.classList.remove('open');
      toggleBtn.classList.remove('active');
    }
  });

  toggleBtn.addEventListener('click', () => {
    addForm.classList.toggle('open');
    const isAddOpen = addForm.classList.contains('open');
    toggleBtn.classList.toggle('active', isAddOpen);
    if (isAddOpen) {
      settingsSection.classList.remove('open');
      toggleSettingsBtn.classList.remove('active');
      const minInput = document.getElementById('input-minutes');
      minInput.focus();
      minInput.select();
    }
  });

  // 進階選項（名稱、顏色、重生）展開/收合
  const toggleAdvancedBtn = document.getElementById('toggle-advanced-btn');
  const advancedDrawer = document.getElementById('advanced-drawer');
  if (toggleAdvancedBtn && advancedDrawer) {
    toggleAdvancedBtn.addEventListener('click', () => {
      advancedDrawer.classList.toggle('open');
      toggleAdvancedBtn.classList.toggle('open', advancedDrawer.classList.contains('open'));
    });
  }

  // 尺寸調整滑桿事件
  const sizeSlider = document.getElementById('mush-size-slider');
  sizeSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    applySizeToUI(val);
    chrome.storage.local.set({ mushroomSize: val });
  });

  // 尺寸快捷按鈕事件
  document.querySelectorAll('.preset-size-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.dataset.size, 10);
      applySizeToUI(val);
      chrome.storage.local.set({ mushroomSize: val });
    });
  });

  // 顏色選擇
  const colorChips = document.querySelectorAll('.color-chip');
  const previewBadge = document.getElementById('advanced-preview-badge');
  colorChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      colorChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      selectedColor = chip.dataset.color;
      if (previewBadge) {
        previewBadge.textContent = chip.textContent.trim();
      }
    });
  });

  // 模式切換：剩餘時間 vs 結束時間
  const tabDuration = document.getElementById('tab-duration');
  const tabEndtime = document.getElementById('tab-endtime');
  const durationBox = document.getElementById('duration-input-box');
  const endtimeBox = document.getElementById('endtime-input-box');

  tabDuration.addEventListener('click', () => {
    currentMode = 'duration';
    tabDuration.classList.add('active');
    tabEndtime.classList.remove('active');
    durationBox.classList.remove('hidden');
    endtimeBox.classList.add('hidden');
  });

  tabEndtime.addEventListener('click', () => {
    currentMode = 'endtime';
    tabEndtime.classList.add('active');
    tabDuration.classList.remove('active');
    endtimeBox.classList.remove('hidden');
    durationBox.classList.add('hidden');

    // 預設填入 1 小時後的時間
    if (!document.getElementById('input-endtime').value) {
      const future = new Date(Date.now() + 60 * 60 * 1000);
      const hh = String(future.getHours()).padStart(2, '0');
      const mm = String(future.getMinutes()).padStart(2, '0');
      document.getElementById('input-endtime').value = `${hh}:${mm}`;
    }
  });

  // 點擊/聚焦時自動全選數字（懶人友善），按 Enter 直接開始計時
  const hInput = document.getElementById('input-hours');
  const mInput = document.getElementById('input-minutes');
  [hInput, mInput].forEach((input) => {
    input.addEventListener('focus', () => input.select());
    input.addEventListener('click', () => input.select());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddMushroom();
      }
    });
  });

  // 歸零按鈕
  const resetBtn = document.getElementById('btn-reset-time');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      hInput.value = 0;
      mInput.value = 0;
    });
  }

  // 快捷時間按鈕 (+15分, +30分, +1h, etc.)
  document.querySelectorAll('.preset-btn').forEach((btn) => {
    if (btn.id === 'btn-reset-time') return;
    btn.addEventListener('click', () => {
      const addH = parseInt(btn.dataset.h, 10) || 0;
      const addM = parseInt(btn.dataset.m, 10) || 0;

      let currentH = parseInt(hInput.value, 10) || 0;
      let currentM = parseInt(mInput.value, 10) || 0;

      let totalM = (currentH + addH) * 60 + (currentM + addM);
      hInput.value = Math.floor(totalM / 60);
      mInput.value = totalM % 60;
    });
  });

  // 提交新增香菇
  document.getElementById('submit-add-btn').addEventListener('click', handleAddMushroom);

  // 清空已結束按鈕
  document.getElementById('clear-finished-btn').addEventListener('click', async () => {
    mushrooms = mushrooms.filter((m) => m.status !== 'completed');
    await saveMushrooms();
    renderMushrooms();
  });
}

// 處理新增香菇邏輯
async function handleAddMushroom() {
  const nameInput = document.getElementById('mush-name');
  let name = nameInput.value.trim();

  // 若沒輸入名稱，預設為「顏色 + #序號」
  if (!name) {
    const count = mushrooms.filter((m) => m.color === selectedColor).length + 1;
    name = `${COLOR_NAMES[selectedColor].label} #${count}`;
  }

  const now = Date.now();
  let finishTime = now;
  let durationMs = 0;

  if (currentMode === 'duration') {
    const hours = parseInt(document.getElementById('input-hours').value, 10) || 0;
    const minutes = parseInt(document.getElementById('input-minutes').value, 10) || 0;
    durationMs = (hours * 3600 + minutes * 60) * 1000;
    if (durationMs <= 0) {
      alert('請輸入有效的倒數時間！');
      return;
    }
    finishTime = now + durationMs;
  } else {
    // 指定結束時刻
    const timeVal = document.getElementById('input-endtime').value;
    if (!timeVal) {
      alert('請選擇結束時間！');
      return;
    }
    const [hh, mm] = timeVal.split(':').map(Number);
    const target = new Date();
    target.setHours(hh, mm, 0, 0);

    // 如果指定時間小於當前時間，表示是隔天的這個時間
    if (target.getTime() <= now) {
      target.setDate(target.getDate() + 1);
    }
    finishTime = target.getTime();
    durationMs = finishTime - now;
  }

  const enableRespawn = document.getElementById('enable-respawn').checked;
  const respawnMins = enableRespawn ? (parseInt(document.getElementById('respawn-mins').value, 10) || 5) : 0;
  const respawnTime = finishTime + respawnMins * 60 * 1000;

  const newMushroom = {
    id: 'mush_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    name,
    color: selectedColor,
    totalDurationMs: durationMs,
    startTime: now,
    finishTime,
    respawnMinutes: respawnMins,
    respawnTime,
    status: 'battling',
    createdAt: now
  };

  mushrooms.unshift(newMushroom);
  await saveMushrooms();

  // 註冊第一階段鬧鐘
  chrome.alarms.create(`finish__${newMushroom.id}`, {
    when: finishTime
  });

  // 重置表單並收合
  nameInput.value = '';
  document.getElementById('input-hours').value = 0;
  document.getElementById('input-minutes').value = 30;
  selectedColor = 'special';
  document.querySelectorAll('.color-chip').forEach((c) => {
    c.classList.toggle('active', c.dataset.color === 'special');
  });
  const previewBadge = document.getElementById('advanced-preview-badge');
  if (previewBadge) previewBadge.textContent = '✨ 特殊';
  const advancedDrawer = document.getElementById('advanced-drawer');
  if (advancedDrawer) advancedDrawer.classList.remove('open');
  const toggleAdvancedBtn = document.getElementById('toggle-advanced-btn');
  if (toggleAdvancedBtn) toggleAdvancedBtn.classList.remove('open');

  document.getElementById('add-form').classList.remove('open');
  document.getElementById('toggle-add-btn').classList.remove('active');
  renderMushrooms();
}

// 每秒更新計時器與進度條
function startTick() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(() => {
    updateCountdowns();
  }, 1000);
}

function updateCountdowns() {
  const now = Date.now();
  let hasStateChange = false;

  mushrooms.forEach((mush) => {
    const cardEl = document.getElementById(`card-${mush.id}`);
    if (!cardEl) return;

    if (mush.status === 'battling') {
      const remain = mush.finishTime - now;
      if (remain <= 0) {
        // 戰鬥結束，進入重生倒數
        mush.status = mush.respawnMinutes > 0 ? 'respawning' : 'completed';
        hasStateChange = true;
      } else {
        updateCardUI(cardEl, mush, remain, mush.totalDurationMs, 'battling');
      }
    } else if (mush.status === 'respawning') {
      const remain = mush.respawnTime - now;
      if (remain <= 0) {
        // 重生冷卻完成
        mush.status = 'completed';
        hasStateChange = true;
      } else {
        const totalRespawnMs = (mush.respawnMinutes || 5) * 60 * 1000;
        updateCardUI(cardEl, mush, remain, totalRespawnMs, 'respawning');
      }
    }
  });

  if (hasStateChange) {
    saveMushrooms();
    renderMushrooms();
  }
}

// 刷新單張卡片的倒數與進度條 UI
function updateCardUI(cardEl, mush, remainMs, totalMs, phase) {
  const digitsEl = cardEl.querySelector('.countdown-digits');
  const barEl = cardEl.querySelector('.progress-bar');

  if (digitsEl) {
    digitsEl.textContent = formatTime(remainMs);
  }

  if (barEl && totalMs > 0) {
    const percent = Math.min(100, Math.max(0, (remainMs / totalMs) * 100));
    barEl.style.width = `${percent}%`;
  }
}

// 渲染完整卡片列表
function renderMushrooms() {
  const listContainer = document.getElementById('mushrooms-list');
  const emptyState = document.getElementById('empty-state');

  if (mushrooms.length === 0) {
    listContainer.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  const now = Date.now();

  listContainer.innerHTML = mushrooms.map((mush) => {
    const colorInfo = COLOR_NAMES[mush.color] || COLOR_NAMES.red;
    let phaseText = '⚔️ 戰鬥中';
    let phaseClass = 'battling';
    let remainMs = mush.finishTime - now;
    let timeHint = `預計 ${formatClock(mush.finishTime)} 打完`;

    if (mush.status === 'respawning' || (mush.status === 'battling' && remainMs <= 0 && mush.respawnTime > now)) {
      phaseText = '🌱 重生倒數中';
      phaseClass = 'respawning';
      remainMs = mush.respawnTime - now;
      timeHint = `預計 ${formatClock(mush.respawnTime)} 刷新`;
    } else if (mush.status === 'completed' || remainMs <= 0) {
      phaseText = '🎉 已重生';
      phaseClass = 'completed';
      remainMs = 0;
      timeHint = '新香菇已在原地刷新！';
    }

    return `
      <div id="card-${mush.id}" class="mushroom-card color-${mush.color}">
        <div class="card-header">
          <div class="card-title-group">
            <span class="color-badge">${colorInfo.icon}</span>
            <span class="mush-card-name">${escapeHtml(mush.name)}</span>
          </div>
          <span class="status-tag ${phaseClass}">${phaseText}</span>
        </div>

        <div class="card-body">
          <div class="timer-box">
            <span class="timer-label">${phaseClass === 'respawning' ? '距離重生剩餘' : (phaseClass === 'completed' ? '狀態' : '距離打完剩餘')}</span>
            <div class="countdown-digits ${phaseClass}">${formatTime(remainMs)}</div>
          </div>
          <span class="target-time-hint">${timeHint}</span>
        </div>

        <div class="progress-container">
          <div class="progress-bar ${phaseClass}" style="width: 100%;"></div>
        </div>

        <div class="card-actions">
          <button class="btn-card-action toggle-pin ${mush.isPinned ? 'pinned' : ''}" data-id="${mush.id}" title="${mush.isPinned ? '取消釘選' : '釘選到網頁畫面'}">
            ${mush.isPinned ? '📍 已釘選' : '📌 釘選'}
          </button>
          ${mush.status === 'battling' ? `
            <button class="btn-card-action fast-finish" data-id="${mush.id}" title="提早打完，直接進入5分鐘重生倒數！">
              ⚡ 提前打完
            </button>
          ` : ''}
          <button class="btn-card-action delete" data-id="${mush.id}" title="刪除此香菇">
            🗑️ 刪除
          </button>
        </div>
      </div>
    `;
  }).join('');

  // 綁定卡片按鈕事件
  listContainer.querySelectorAll('.toggle-pin').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleTogglePin(btn.dataset.id);
    });
  });

  listContainer.querySelectorAll('.fast-finish').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleFastFinish(btn.dataset.id);
    });
  });

  listContainer.querySelectorAll('.delete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDelete(btn.dataset.id);
    });
  });

  updateCountdowns();
}

// 釘選/取消釘選處理
async function handleTogglePin(id) {
  const mush = mushrooms.find((m) => m.id === id);
  if (!mush) return;
  mush.isPinned = !mush.isPinned;
  await saveMushrooms();
  renderMushrooms();
}

// 提前打完處理（立即進入重生冷卻）
async function handleFastFinish(id) {
  const mush = mushrooms.find((m) => m.id === id);
  if (!mush) return;

  const now = Date.now();
  mush.status = 'respawning';
  mush.finishTime = now;
  mush.respawnTime = now + (mush.respawnMinutes || 5) * 60 * 1000;

  // 清除戰鬥結束鬧鐘，設定重生鬧鐘
  chrome.alarms.clear(`finish__${id}`);
  chrome.alarms.create(`respawn__${id}`, {
    when: mush.respawnTime
  });

  await saveMushrooms();
  renderMushrooms();
}

// 刪除香菇
async function handleDelete(id) {
  chrome.alarms.clear(`finish__${id}`);
  chrome.alarms.clear(`respawn__${id}`);
  mushrooms = mushrooms.filter((m) => m.id !== id);
  await saveMushrooms();
  renderMushrooms();
}

// 更新統計數字
function updateStats() {
  const battling = mushrooms.filter((m) => m.status === 'battling').length;
  const respawning = mushrooms.filter((m) => m.status === 'respawning').length;

  document.getElementById('stat-battling').textContent = battling;
  document.getElementById('stat-respawning').textContent = respawning;
}

// 時間格式化 helpers
function formatTime(ms) {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return `${hh}:${mm}:${ss}`;
}

function formatClock(timestamp) {
  const date = new Date(timestamp);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

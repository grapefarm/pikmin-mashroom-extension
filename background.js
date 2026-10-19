// background.js - 皮克敏香菇計時器背景服務工作緒 (Service Worker)

// 監聽鬧鐘觸發
chrome.alarms.onAlarm.addListener(async (alarm) => {
  const [type, id] = alarm.name.split('__');
  if (!id) return;

  const data = await chrome.storage.local.get(['mushrooms']);
  const mushrooms = data.mushrooms || [];
  const index = mushrooms.findIndex((m) => m.id === id);
  if (index === -1) return;

  const mush = mushrooms[index];

  if (type === 'finish') {
    // 第一階段：戰鬥結束提醒
    mush.status = 'respawning';
    await chrome.storage.local.set({ mushrooms });

    // 發送桌面系統通知
    chrome.notifications.create(`notify_finish_${mush.id}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: `🍄 戰鬥結束！【${mush.name}】`,
      message: `恭喜打完！快開遊戲領水果與明信片！\n⏳ ${mush.respawnMinutes || 5} 分鐘後將重生刷新新菇！`,
      priority: 2,
      requireInteraction: true
    });

    // 自動排程第二階段：5分鐘重生鬧鐘
    const respawnTime = mush.respawnTime || (Date.now() + (mush.respawnMinutes || 5) * 60 * 1000);
    chrome.alarms.create(`respawn__${mush.id}`, {
      when: respawnTime
    });

  } else if (type === 'respawn') {
    // 第二階段：重生提醒
    mush.status = 'completed';
    await chrome.storage.local.set({ mushrooms });

    // 發送重生通知
    chrome.notifications.create(`notify_respawn_${mush.id}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: `✨ 香菇已重生！【${mush.name}】`,
      message: `冷卻時間到！新香菇已刷新登場，快進場佔位！🍄💨`,
      priority: 2,
      requireInteraction: true
    });
  }
});

// 點擊通知時可開啟擴充功能或簡單關閉
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.notifications.clear(notificationId);
});

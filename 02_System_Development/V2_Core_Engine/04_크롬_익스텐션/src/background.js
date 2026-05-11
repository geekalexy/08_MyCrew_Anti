// Background service worker for MyCrew Extension

chrome.action.onClicked.addListener((tab) => {
  // 사용자가 익스텐션 아이콘을 클릭하면 사이드 패널을 강제로 엽니다.
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(err => console.error(err));
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('MyCrew Antigravity Extension installed.');
});

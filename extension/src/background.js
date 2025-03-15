// background.js: 확장 프로그램 백그라운드 작업 처리

chrome.runtime.onInstalled.addListener(() => {
  console.log('GitHub Portfolio Builder 확장 프로그램이 설치되었습니다.');
});

// GitHub 페이지인 경우 확장 프로그램 아이콘 활성화
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('github.com')) {
    chrome.action.setIcon({
      tabId: tabId,
      path: {
        "16": "icons/icon16.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png"
      }
    });
  }
});

// 메시지 리스너 설정 - 현재 레포지토리 정보 가져오기만 처리
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('메시지 수신:', request);
  
  // 현재 레포지토리 정보 가져오기
  if (request.action === 'getCurrentRepo') {
    // 현재 탭의 URL에서 레포지토리 정보 추출
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({ error: '활성화된 탭을 찾을 수 없습니다.' });
        return;
      }
      
      const url = tabs[0].url;
      if (!url) {
        sendResponse({ error: 'URL을 확인할 수 없습니다.' });
        return;
      }
      
      if (url.includes('github.com/') && url.split('github.com/').length > 1) {
        const path = url.split('github.com/')[1].split('/');
        if (path.length >= 2) {
          const owner = path[0];
          const repo = path[1];
          sendResponse({ owner, repo, repoUrl: url });
        } else {
          sendResponse({ error: 'GitHub 레포지토리를 찾을 수 없습니다.' });
        }
      } else {
        sendResponse({ error: 'GitHub 페이지가 아닙니다.' });
      }
    });
    return true; // 비동기 응답을 위해 true 반환
  }
});
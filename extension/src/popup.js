// 서버 URL
const SERVER_URL = 'http://localhost:3000';

// 상태 데이터
let appState = {
  step: 1,
  repoOwner: '',
  repoName: '',
  backgroundKnowledge: null,
  contributionAnalysis: null,
  username: '',
  portfolioHtml: '',
  progress: 0
};

// 개선된 API 호출 함수
async function callApi(endpoint, data) {
  try {
    console.log(`API 호출: ${endpoint}`, data);
    
    const response = await fetch(`${SERVER_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    console.log('응답 상태:', response.status, response.statusText);
    
    // 응답 형식 확인
    const contentType = response.headers.get('content-type');
    console.log('응답 콘텐츠 타입:', contentType);
    
    // 응답이 JSON이 아닌 경우 처리
    if (!contentType || !contentType.includes('application/json')) {
      // 응답 텍스트 읽기
      const text = await response.text();
      console.error('응답이 JSON이 아님. 응답 (처음 100자):', text.substring(0, 100));
      throw new Error('서버가 유효한 JSON을 반환하지 않았습니다. 서버 상태를 확인하세요.');
    }
    
    // 응답 상태 코드가 OK가 아닌 경우 처리
    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.message || `서버 오류: ${response.status}`);
      } catch (jsonError) {
        throw new Error(`서버 응답 오류 (${response.status}): JSON 파싱 실패`);
      }
    }
    
    try {
      // JSON 파싱 시도
      return await response.json();
    } catch (jsonError) {
      console.error('JSON 파싱 오류:', jsonError);
      throw new Error('서버 응답 데이터를 파싱할 수 없습니다');
    }
  } catch (error) {
    console.error('API 호출 오류:', error);
    throw error;
  }
}

// 서버 상태 확인 함수
async function checkServerStatus() {
  try {
    const response = await fetch(`${SERVER_URL}/ping`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (response.ok) {
      try {
        const data = await response.json();
        console.log('서버 상태 확인 성공:', data);
        return true;
      } catch (e) {
        console.error('서버 응답 파싱 실패:', e);
        return false;
      }
    } else {
      console.error('서버 상태 확인 실패:', response.status);
      return false;
    }
  } catch (error) {
    console.error('서버 연결 실패:', error);
    return false;
  }
}

document.addEventListener('DOMContentLoaded', async function() {
  // DOM 요소 참조
  const statusElement = document.getElementById('status');
  const loaderElement = document.getElementById('loader');
  const resultElement = document.getElementById('result');
  const resultActionsElement = document.getElementById('resultActions');
  const progressBar = document.querySelector('.progress-bar');
  const progressText = document.getElementById('progress-text');

  // 버튼 참조
  const analyzeRepoBtn = document.getElementById('analyzeRepoBtn');
  const analyzeContributionsBtn = document.getElementById('analyzeContributionsBtn');
  const generatePortfolioBtn = document.getElementById('generatePortfolioBtn');
  const copyHtmlBtn = document.getElementById('copyHtmlBtn');
  const downloadHtmlBtn = document.getElementById('downloadHtmlBtn');
  const previewBtn = document.getElementById('previewBtn');

  // 단계 컨테이너 참조
  const step1Container = document.getElementById('step1');
  const step2Container = document.getElementById('step2');
  const step3Container = document.getElementById('step3');
  const step1Status = document.getElementById('step1-status');
  const step2Status = document.getElementById('step2-status');
  const step3Status = document.getElementById('step3-status');

  // 입력 필드 참조
  const repoUrlInput = document.getElementById('repoUrl');
  const usernameInput = document.getElementById('username');

  // 서버 상태 확인 버튼 추가
  const serverCheckBtn = document.createElement('button');
  serverCheckBtn.textContent = '서버 연결 확인';
  serverCheckBtn.className = 'btn btn-sm btn-outline-secondary mt-2 mb-2';
  serverCheckBtn.addEventListener('click', async function() {
    showStatus('서버 연결 확인 중...', 'info');
    const isConnected = await checkServerStatus();
    if (isConnected) {
      showStatus('서버에 연결되었습니다.', 'success');
    } else {
      showStatus('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.', 'danger');
    }
  });
  
  // 필수 요소 확인
  if (!statusElement || !loaderElement || !resultElement) {
    console.error("필수 DOM 요소를 찾을 수 없습니다. HTML 파일을 확인하세요.");
    return;
  }
  
  // 서버 확인 버튼 추가
  if (statusElement.parentNode) {
    statusElement.parentNode.insertBefore(serverCheckBtn, statusElement.nextSibling);
  }

  // 초기 서버 상태 확인
  const isServerConnected = await checkServerStatus();
  if (!isServerConnected) {
    showStatus('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.', 'warning');
  }

  // 상태 표시 함수
  function showStatus(message, type = 'primary') {
    statusElement.textContent = message;
    statusElement.className = `alert alert-${type}`;
  }

  // 진행 상태 업데이트 함수
  function updateProgress(percent) {
    if (!progressBar || !progressText) return;
    
    appState.progress = percent;
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${percent}%`;
  }

  // 단계 상태 업데이트 함수
  function updateStepStatus(step, status, message) {
    const statusElements = [step1Status, step2Status, step3Status];
    const statusEl = statusElements[step - 1];
    
    if (!statusEl) return;
    
    switch (status) {
      case 'waiting':
        statusEl.textContent = '대기 중';
        statusEl.className = 'badge bg-secondary';
        break;
      case 'in-progress':
        statusEl.textContent = '진행 중';
        statusEl.className = 'badge bg-primary';
        break;
      case 'completed':
        statusEl.textContent = '완료';
        statusEl.className = 'badge bg-success';
        break;
      case 'error':
        statusEl.textContent = '오류';
        statusEl.className = 'badge bg-danger';
        break;
    }
    
    if (message) {
      showStatus(message, status === 'error' ? 'danger' : 'info');
    }
  }

  // 활성 단계 설정 함수
  function setActiveStep(step) {
    appState.step = step;
    
    if (!step1Container || !step2Container || !step3Container) return;
    
    [step1Container, step2Container, step3Container].forEach((container, index) => {
      if (index + 1 === step) {
        container.classList.add('step-active');
      } else {
        container.classList.remove('step-active');
      }
    });
  }

  // 1. 레포지토리 분석 함수
  async function analyzeRepo() {
    try {
      // 서버 상태 확인
      const isConnected = await checkServerStatus();
      if (!isConnected) {
        throw new Error('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.');
      }
      
      updateStepStatus(1, 'in-progress', '레포지토리 분석 중...');
      setActiveStep(1);
      loaderElement.style.display = 'block';
      if (analyzeRepoBtn) analyzeRepoBtn.disabled = true;
      resultElement.innerHTML = '';
      if (resultActionsElement) resultActionsElement.style.display = 'none';
      updateProgress(10);
      
      // 개선된 API 호출 함수 사용
      const data = await callApi('api/analyze-repo', {
        owner: appState.repoOwner,
        repo: appState.repoName
      });
      
      updateProgress(30);
      appState.backgroundKnowledge = data.backgroundKnowledge;
      
      // 분석 결과 표시
      resultElement.innerHTML = `
        <h4>레포지토리 분석 결과</h4>
        <div class="card mb-3">
          <div class="card-body">
            <h5 class="card-title">${data.repoInfo.name}</h5>
            <h6 class="card-subtitle mb-2 text-muted">by ${data.repoInfo.owner}</h6>
            <p class="card-text">${data.repoInfo.description || '설명 없음'}</p>
            <div class="mb-2">
              <span class="badge bg-primary">${data.repoInfo.language || 'Unknown'}</span>
              <span class="badge bg-secondary">⭐ ${data.repoInfo.stars}</span>
              <span class="badge bg-secondary">🍴 ${data.repoInfo.forks}</span>
            </div>
            <h6>프로젝트 개요</h6>
            <p>${data.backgroundKnowledge.projectOverview || '정보 없음'}</p>
            <h6>주요 기능</h6>
            <ul>
              ${(data.backgroundKnowledge.keyFeatures || []).map(feature => `<li>${feature}</li>`).join('')}
            </ul>
            <h6>기술 스택</h6>
            <div>
              ${(data.backgroundKnowledge.techStack || []).map(tech => 
                `<span class="badge bg-info text-dark m-1">${tech}</span>`
              ).join('')}
            </div>
          </div>
        </div>
      `;
      
      updateProgress(40);
      updateStepStatus(1, 'completed', '레포지토리 분석 완료!');
      updateStepStatus(2, 'waiting');
      setActiveStep(2);
      
      if (analyzeRepoBtn) analyzeRepoBtn.disabled = false;
      
    } catch (error) {
      console.error('레포지토리 분석 오류:', error);
      updateStepStatus(1, 'error', `오류: ${error.message}`);
      if (analyzeRepoBtn) analyzeRepoBtn.disabled = false;
    } finally {
      loaderElement.style.display = 'none';
    }
  }

  // 2. 사용자 기여 분석 함수
  async function analyzeContributions() {
    try {
      // 서버 상태 확인
      const isConnected = await checkServerStatus();
      if (!isConnected) {
        throw new Error('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.');
      }
      
      if (!usernameInput) {
        showStatus('사용자명 입력 필드를 찾을 수 없습니다.', 'warning');
        return;
      }

      const username = usernameInput.value.trim();
      if (!username) {
        showStatus('GitHub 사용자명을 입력해주세요.', 'warning');
        return;
      }
      
      appState.username = username;
      
      updateStepStatus(2, 'in-progress', '사용자 기여 분석 중...');
      loaderElement.style.display = 'block';
      if (analyzeContributionsBtn) analyzeContributionsBtn.disabled = true;
      updateProgress(50);
      
      // 개선된 API 호출 함수 사용
      const data = await callApi('api/analyze-contributions', {
        owner: appState.repoOwner,
        repo: appState.repoName,
        username: username
      });
      
      updateProgress(70);
      appState.contributionAnalysis = data.contributionAnalysis;
      
      // 결과에 기여 분석 추가
      const contributionSection = document.createElement('div');
      contributionSection.innerHTML = `
        <h4>사용자 기여 분석</h4>
        <div class="card mb-3">
          <div class="card-body">
            <h5 class="card-title">${username}의 기여</h5>
            
            <h6>주요 기여 영역</h6>
            <ul>
              ${(data.contributionAnalysis.contributionAreas || []).map(area => `<li>${area}</li>`).join('')}
            </ul>
            
            <h6>기술적 역량</h6>
            <div class="mb-2">
              ${(data.contributionAnalysis.technicalSkills || []).map(skill => 
                `<span class="badge bg-success m-1">${skill}</span>`
              ).join('')}
            </div>
            
            <h6>기여 요약</h6>
            <p>${data.contributionAnalysis.contributionSummary || '정보 없음'}</p>
            
            <h6>핵심 코드 변경사항</h6>
            <ul>
              ${(data.contributionAnalysis.keyCodeChanges || []).map(change => `<li>${change}</li>`).join('')}
            </ul>
            
            <h6>영향력 분석</h6>
            <p>${data.contributionAnalysis.impactAnalysis || '정보 없음'}</p>
          </div>
        </div>
      `;
      
      resultElement.appendChild(contributionSection);
      
      updateProgress(80);
      updateStepStatus(2, 'completed', '사용자 기여 분석 완료!');
      updateStepStatus(3, 'waiting');
      setActiveStep(3);
      
      if (analyzeContributionsBtn) analyzeContributionsBtn.disabled = false;
      
    } catch (error) {
      console.error('사용자 기여 분석 오류:', error);
      updateStepStatus(2, 'error', `오류: ${error.message}`);
      if (analyzeContributionsBtn) analyzeContributionsBtn.disabled = false;
    } finally {
      loaderElement.style.display = 'none';
    }
  }

  // 3. 포트폴리오 생성 함수
  async function generatePortfolio() {
    try {
      // 서버 상태 확인
      const isConnected = await checkServerStatus();
      if (!isConnected) {
        throw new Error('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.');
      }
      
      // 이전 단계 데이터 확인
      if (!appState.backgroundKnowledge) {
        showStatus('먼저 레포지토리를 분석해주세요.', 'warning');
        setActiveStep(1);
        return;
      }
      
      if (!appState.contributionAnalysis) {
        showStatus('먼저 사용자 기여를 분석해주세요.', 'warning');
        setActiveStep(2);
        return;
      }
      
      updateStepStatus(3, 'in-progress', '포트폴리오 생성 중...');
      loaderElement.style.display = 'block';
      if (generatePortfolioBtn) generatePortfolioBtn.disabled = true;
      resultElement.innerHTML = '';
      updateProgress(85);
      
      // 개선된 API 호출 함수 사용
      const data = await callApi('api/generate-portfolio', {
        backgroundKnowledge: appState.backgroundKnowledge,
        contributionAnalysis: appState.contributionAnalysis,
        username: appState.username
      });
      
      updateProgress(95);
      appState.portfolioHtml = data.html;
      
      // iFrame에서 포트폴리오 표시
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '400px';
      iframe.style.border = '1px solid #ddd';
      iframe.style.borderRadius = '5px';
      
      resultElement.appendChild(iframe);
      
      const iframeDoc = iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(data.html);
      iframeDoc.close();
      
      // 결과 작업 버튼 표시
      if (resultActionsElement) resultActionsElement.style.display = 'block';
      
      updateProgress(100);
      updateStepStatus(3, 'completed', '포트폴리오 생성 완료!');
      
      if (generatePortfolioBtn) generatePortfolioBtn.disabled = false;
      
    } catch (error) {
      console.error('포트폴리오 생성 오류:', error);
      updateStepStatus(3, 'error', `오류: ${error.message}`);
      if (generatePortfolioBtn) generatePortfolioBtn.disabled = false;
    } finally {
      loaderElement.style.display = 'none';
    }
  }

  // HTML 복사 함수
  function copyHtml() {
    if (!appState.portfolioHtml) return;
    
    navigator.clipboard.writeText(appState.portfolioHtml)
      .then(() => {
        if (copyHtmlBtn) {
          copyHtmlBtn.textContent = '복사됨!';
          setTimeout(() => {
            copyHtmlBtn.textContent = 'HTML 복사';
          }, 2000);
        }
      })
      .catch(err => {
        console.error('복사 실패:', err);
        showStatus('HTML 복사 실패', 'danger');
      });
  }

  // HTML 다운로드 함수
  function downloadHtml() {
    if (!appState.portfolioHtml) return;
    
    const blob = new Blob([appState.portfolioHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.href = url;
    a.download = `${appState.repoName}-portfolio.html`;
    a.click();
    
    URL.revokeObjectURL(url);
  }

  // HTML 미리보기 함수
  function previewHtml() {
    if (!appState.portfolioHtml) return;
    
    const previewWindow = window.open('', '_blank');
    previewWindow.document.write(appState.portfolioHtml);
    previewWindow.document.close();
  }
  
  // 현재 탭이 GitHub 레포지토리인지 확인
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const url = tabs[0].url;
    const githubRepoPattern = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\/.*)?$/;
    const match = url.match(githubRepoPattern);
    
    if (match && repoUrlInput) {
      appState.repoOwner = match[1];
      appState.repoName = match[2];
      repoUrlInput.value = `https://github.com/${appState.repoOwner}/${appState.repoName}`;
      showStatus('GitHub 레포지토리가 감지되었습니다.', 'info');
    } else {
      showStatus('GitHub 레포지토리 페이지에서 실행해주세요.', 'warning');
      if (analyzeRepoBtn) analyzeRepoBtn.disabled = true;
    }
  });
  
  // 이벤트 리스너 설정 - 각 요소가 존재하는지 확인 후 설정
  if (analyzeRepoBtn) analyzeRepoBtn.addEventListener('click', analyzeRepo);
  if (analyzeContributionsBtn) analyzeContributionsBtn.addEventListener('click', analyzeContributions);
  if (generatePortfolioBtn) generatePortfolioBtn.addEventListener('click', generatePortfolio);
  if (copyHtmlBtn) copyHtmlBtn.addEventListener('click', copyHtml);
  if (downloadHtmlBtn) downloadHtmlBtn.addEventListener('click', downloadHtml);
  if (previewBtn) previewBtn.addEventListener('click', previewHtml);
  
  // 레포지토리 URL 입력 이벤트
  if (repoUrlInput) {
    repoUrlInput.addEventListener('change', function() {
      const url = repoUrlInput.value;
      const githubRepoPattern = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\/.*)?$/;
      const match = url.match(githubRepoPattern);
      
      if (match) {
        appState.repoOwner = match[1];
        appState.repoName = match[2];
        if (analyzeRepoBtn) analyzeRepoBtn.disabled = false;
      } else {
        showStatus('유효한 GitHub 레포지토리 URL을 입력해주세요.', 'warning');
        if (analyzeRepoBtn) analyzeRepoBtn.disabled = true;
      }
    });
  }
});
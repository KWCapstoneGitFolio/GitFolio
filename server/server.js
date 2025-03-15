require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Anthropic } = require('@anthropic-ai/sdk');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// API 키 검증
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

// Anthropic 클라이언트 초기화
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
// GitHub API 헬퍼 함수들
async function fetchRepoInfo(owner, repo) {
  try {
    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}`);
    return response.data;
  } catch (error) {
    console.error('레포지토리 정보 가져오기 오류:', error);
    throw new Error('레포지토리 정보를 가져올 수 없습니다.');
  }
}

async function fetchReadme(owner, repo) {
  try {
    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/readme`, {
      headers: { Accept: 'application/vnd.github.v3.raw' }
    });
    return response.data;
  } catch (error) {
    console.error('README 가져오기 오류:', error);
    return ''; // README가 없을 수 있음
  }
}

async function fetchContents(owner, repo) {
  try {
    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents`);
    return response.data;
  } catch (error) {
    console.error('콘텐츠 가져오기 오류:', error);
    return []; // 접근 가능한 콘텐츠가 없을 수 있음
  }
}

async function fetchCommits(owner, repo) {
  try {
    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=10`);
    return response.data;
  } catch (error) {
    console.error('커밋 가져오기 오류:', error);
    return []; // 커밋이 없을 수 있음
  }
}

async function fetchUserContributions(owner, repo, username) {
  try {
    // 최근 커밋 중 특정 사용자의 커밋 필터링
    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/commits?author=${username}&per_page=10`);
    return response.data;
  } catch (error) {
    console.error('사용자 기여 가져오기 오류:', error);
    return []; // 기여가 없을 수 있음
  }
}

async function fetchCommitDetails(owner, repo, sha) {
  try {
    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}`);
    return response.data;
  } catch (error) {
    console.error('커밋 상세정보 가져오기 오류:', error);
    throw new Error('커밋 상세정보를 가져올 수 없습니다.');
  }
}

// 1. 레포지토리 분석 및 배경지식 생성 엔드포인트
app.post('/api/analyze-repo', async (req, res) => {
  try {
    const { owner, repo } = req.body;
    
    if (!owner || !repo) {
      return res.status(400).json({ error: '레포지토리 소유자와 이름이 필요합니다.' });
    }

    // GitHub API로 레포지토리 데이터 가져오기
    const repoInfo = await fetchRepoInfo(owner, repo);
    const readme = await fetchReadme(owner, repo);
    const contents = await fetchContents(owner, repo);
    const commits = await fetchCommits(owner, repo);
    
    // 프로젝트 배경지식 정리를 위한 Claude API 호출
    const prompt = `
      다음 GitHub 레포지토리에 대한 배경지식을 만들어주세요:
      
      레포지토리 정보:
      이름: ${repoInfo.name}
      설명: ${repoInfo.description || '설명 없음'}
      주요 언어: ${repoInfo.language || '정보 없음'}
      스타 수: ${repoInfo.stargazers_count}
      포크 수: ${repoInfo.forks_count}
      
      README 내용:
      ${readme || '내용 없음'}
      
      파일 구조:
      ${contents.map(file => `- ${file.name} (${file.type})`).join('\n')}
      
      최근 커밋 정보:
      ${commits.map(commit => 
        `- ${commit.commit.message} (${new Date(commit.commit.author.date).toLocaleDateString()})`
      ).join('\n')}
      
      다음 정보를 포함한 프로젝트 배경지식을 JSON 형식으로 생성해주세요:
      1. 프로젝트 개요 (projectOverview)
      2. 주요 기능 (keyFeatures) - 배열 형식
      3. 사용된 기술 스택 (techStack) - 배열 형식
      4. 프로젝트 구조 (projectStructure)
      5. 개발 히스토리 (developmentHistory)
      
      전체 응답을 유효한 JSON 형식으로 제공해주세요.
    `;
    
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }]
    });
    
    // JSON 응답 추출 및 파싱
    const content = response.content[0].text;
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                      content.match(/\{[\s\S]*\}/);
                     
    let backgroundKnowledge;
    if (jsonMatch) {
      try {
        backgroundKnowledge = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } catch (error) {
        console.error('JSON 파싱 오류:', error);
        backgroundKnowledge = { error: 'JSON 파싱 실패', rawContent: content };
      }
    } else {
      backgroundKnowledge = { error: 'JSON 형식이 발견되지 않음', rawContent: content };
    }

    res.json({ 
      repoInfo: {
        name: repoInfo.name,
        owner: repoInfo.owner.login,
        description: repoInfo.description,
        language: repoInfo.language,
        stars: repoInfo.stargazers_count,
        forks: repoInfo.forks_count
      },
      backgroundKnowledge
    });
    
  } catch (error) {
    console.error('레포지토리 분석 오류:', error);
    res.status(500).json({ 
      error: '레포지토리 분석 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// 2. 사용자 기여 코드 분석 엔드포인트
app.post('/api/analyze-contributions', async (req, res) => {
  try {
    const { owner, repo, username } = req.body;
    
    if (!owner || !repo || !username) {
      return res.status(400).json({ error: '레포지토리 정보와 사용자명이 필요합니다.' });
    }

    // 사용자의 기여 가져오기
    const userCommits = await fetchUserContributions(owner, repo, username);
    
    if (userCommits.length === 0) {
      return res.json({ 
        contributions: [],
        analysis: { message: '이 레포지토리에 사용자의 기여가 없습니다.' }
      });
    }
    
    // 각 커밋의 상세 정보 가져오기
    const contributionDetails = await Promise.all(
      userCommits.slice(0, 5).map(async (commit) => {
        const details = await fetchCommitDetails(owner, repo, commit.sha);
        return {
          sha: commit.sha,
          message: commit.commit.message,
          date: commit.commit.author.date,
          additions: details.stats.additions,
          deletions: details.stats.deletions,
          changes: details.files.map(file => ({
            filename: file.filename,
            status: file.status,
            additions: file.additions,
            deletions: file.deletions,
            patch: file.patch
          }))
        };
      })
    );
    
    // 코드 기여 분석을 위한 Claude API 호출
    const prompt = `
      다음은 GitHub 레포지토리 ${owner}/${repo}에 대한 사용자 ${username}의 기여입니다.
      각 커밋과 변경된 코드를 분석하여 사용자가 어떤 역할을 했는지 설명해주세요.
      
      기여 정보:
      ${contributionDetails.map(contrib => `
        커밋: ${contrib.message}
        날짜: ${new Date(contrib.date).toLocaleDateString()}
        추가: ${contrib.additions} 라인
        삭제: ${contrib.deletions} 라인
        
        변경된 파일들:
        ${contrib.changes.map(change => `
          파일: ${change.filename}
          상태: ${change.status}
          추가: ${change.additions} 라인
          삭제: ${change.deletions} 라인
          
          패치:
          ${change.patch || '패치 정보 없음'}
        `).join('\n')}
      `).join('\n\n')}
      
      다음 정보를 포함한 분석을 JSON 형식으로 생성해주세요:
      1. 주요 기여 영역 (contributionAreas) - 배열 형식
      2. 기술적 역량 (technicalSkills) - 배열 형식
      3. 코드 기여 요약 (contributionSummary)
      4. 핵심 코드 변경사항 (keyCodeChanges) - 배열 형식
      5. 영향력 분석 (impactAnalysis)
      
      전체 응답을 유효한 JSON 형식으로 제공해주세요.
    `;
    
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }]
    });
    
    // JSON 응답 추출 및 파싱
    const content = response.content[0].text;
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                      content.match(/\{[\s\S]*\}/);
                     
    let contributionAnalysis;
    if (jsonMatch) {
      try {
        contributionAnalysis = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } catch (error) {
        console.error('JSON 파싱 오류:', error);
        contributionAnalysis = { error: 'JSON 파싱 실패', rawContent: content };
      }
    } else {
      contributionAnalysis = { error: 'JSON 형식이 발견되지 않음', rawContent: content };
    }

    res.json({ 
      username,
      contributionDetails,
      contributionAnalysis
    });
    
  } catch (error) {
    console.error('기여 분석 오류:', error);
    res.status(500).json({ 
      error: '사용자 기여 분석 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// 3. 포트폴리오 생성 엔드포인트
app.post('/api/generate-portfolio', async (req, res) => {
  try {
    const { backgroundKnowledge, contributionAnalysis, username } = req.body;
    
    if (!backgroundKnowledge || !contributionAnalysis) {
      return res.status(400).json({ error: '프로젝트 배경지식과 기여 분석이 필요합니다.' });
    }

    // 포트폴리오 생성을 위한 Claude API 호출
    const prompt = `
      GitHub 프로젝트 기반 포트폴리오를 생성해주세요.
      
      프로젝트 배경지식:
      ${JSON.stringify(backgroundKnowledge, null, 2)}
      
      사용자(${username || '개발자'})의 기여 분석:
      ${JSON.stringify(contributionAnalysis, null, 2)}
      
      다음 정보를 포함한 HTML 포트폴리오 페이지를 생성해주세요:
      1. 프로젝트 개요 및 설명 섹션
      2. 사용자의 역할과 기여 섹션
      3. 기술 스택 및 사용된 기술 섹션
      4. 핵심 코드 기여 하이라이트 섹션
      5. 프로젝트 스크린샷이나 시각 자료를 위한 placeholder
      6. 프로젝트를 통해 입증된 기술적 역량 섹션
      
      HTML 코드만 제공해주세요. 부트스트랩 CSS를 사용하고, 깔끔하고 전문적인 디자인으로 작성해주세요.
      완전한 HTML 문서를 제공해주세요 (HTML, HEAD, BODY 태그 포함).
    `;
    
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }]
    });
    
    const content = response.content[0].text;
    
    // HTML 코드 추출
    const htmlMatch = content.match(/<html[\s\S]*?<\/html>/i) || 
                     content.match(/<!DOCTYPE[\s\S]*?<\/html>/i) ||
                     content.match(/<body[\s\S]*?<\/body>/i) ||
                     content.match(/<div[\s\S]*?<\/div>/i);
                     
    if (htmlMatch) {
      res.json({ 
        html: htmlMatch[0],
        rawContent: content
      });
    } else {
      res.json({ 
        html: content,
        error: 'HTML 형식이 발견되지 않음'
      });
    }
    
  } catch (error) {
    console.error('포트폴리오 생성 오류:', error);
    res.status(500).json({ 
      error: '포트폴리오 생성 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});
app.get('/ping', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
// 상태 확인 엔드포인트
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
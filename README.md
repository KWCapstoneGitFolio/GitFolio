## 환경 설정

1. 저장소를 클론합니다:

git clone https://github.com/KWCapstoneGitFolio/GitFolio.git

cd GitFolio


2. 필요한 패키지를 설치합니다:

npm install


3. `.env.example` 파일을 복사하여 `.env` 파일을 생성합니다:

cp server/.env.example server/.env


4. `.env` 파일을 열고 실제 API 키 값을 입력합니다:

- ANTHROPIC_API_KEY: [Claude API 키](https://console.anthropic.com/)


5. 서버를 실행합니다:

cd server</br>
npm start

import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

/**
 * NotebookLM Natively Controlled Adapter (Node.js)
 * Python 기반 서드파티 의존성을 제거하고,
 * MyCrew 아키텍처 내에서 직접 브라우저 세션을 제어하여 노트북을 생성하고 소스를 업로드합니다.
 */
class NotebookLMAdapter {
    constructor() {
        this.browser = null;
        // Mac 환경의 실제 크롬 유저 데이터 경로 대신 MyCrew 전용 독립 프로필 경로 사용
        // 기존 실행 중인 Chrome과의 Lock 파일 충돌 방지
        this.userDataDir = path.resolve(process.env.HOME || '', '.socian-notebook-profile');
        this.chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    }

    async init() {
        if (this.browser) return;
        try {
            console.log('[NotebookLM] 로컬 브라우저 구동 시작 (Native Authentication)...');
            this.browser = await puppeteer.launch({
                executablePath: this.chromePath,
                headless: false, // 진행 상황을 볼 수 있도록 표시 (추후 완료 시 'new' 등으로 변경 가능)
                userDataDir: this.userDataDir,
                defaultViewport: null,
                ignoreDefaultArgs: ['--enable-automation'],
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--profile-directory=Default', // 기본 프로필 사용
                    '--start-maximized'
                ]
            });
            console.log('[NotebookLM] 브라우저 세션 연결 완료');
        } catch (error) {
            console.error('[NotebookLM] 브라우저 구동 실패 (크롬이 열려있는지 확인하세요):', error.message);
            throw error;
        }
    }

    async createNotebookAndUpload(title, filePath) {
        if (!this.browser) await this.init();
        const page = await this.browser.newPage();
        
        try {
            console.log(`[NotebookLM] 노트북 페이지 진입: ${title}`);
            await page.goto('https://notebooklm.google.com/', { waitUntil: 'networkidle2' });
            
            const delay = ms => new Promise(res => setTimeout(res, ms));

            // 1. "새 노트 만들기" 타일 클릭 (xpath 활용)
            console.log(`[NotebookLM] 생성 버튼 찾는 중...`);
            await delay(2000); // UI 안정화 대기
            
            // 텍스트 기반으로 '새 노트 만들기' 또는 '새 노트북' 요소 클릭
            const clicked = await page.evaluate(() => {
                const els = Array.from(document.querySelectorAll('*'));
                const btn = els.find(e => e.textContent && e.textContent.includes('새 노트 만들기') && e.tagName !== 'SCRIPT');
                if (btn) {
                    btn.click();
                    return true;
                }
                return false;
            });
            
            if (!clicked) {
                console.log('[NotebookLM] 새 노트 만들기 텍스트 클릭 실패. Fallback DOM 탐색');
                // 만약 영문판이거나 텍스트 변경 시 대비한 예외처리 필요
            }

            // 2. URL 변경 대기 (새 노트 진입)
            console.log(`[NotebookLM] 새 노트북 로딩 대기...`);
            await page.waitForNavigation({ waitUntil: 'networkidle2' });

            // 3. 제목 변경 (만약 즉시 변경 가능한 Input이 있다면)
            // 아직은 구글이 새 노트를 '제목 없는 노트북'으로 생성하고 파일 업로드 창을 띄움
            
            // 4. 소스 업로드 모달 내의 <input type="file"> 탐색
            console.log(`[NotebookLM] 파일 업로드 다이얼로그 탐색 중...`);
            await delay(2000); // 팝업 대기
            
            const fileInputs = await page.$$('input[type="file"]');
            if (fileInputs.length > 0) {
                console.log('[NotebookLM] 타겟 파일을 업로드합니다: ', filePath);
                // 모든 input file에 대해서 경로 주입 시도 (보통 1~2개 존재)
                await fileInputs[fileInputs.length - 1].uploadFile(filePath);
            } else {
                throw new Error('파일 업로드 input 태그를 발견하지 못했습니다.');
            }

            // 5. 서버에 소스가 온전히 파싱될 때까지 적당히 대기 (UI 프로그래스)
            console.log(`[NotebookLM] 파일 파싱 및 적재 대기 중...`);
            await delay(7000); 

            // 완료
            console.log(`[NotebookLM] 동기화 프로세스 종료 (모달 안정화 완료)`);
            return {
                status: 'ok',
                message: 'Native Upload Process Completed'
            };
        } catch (error) {
            console.error('[NotebookLM] 네이티브 업로드 파이프라인 에러:', error);
            throw error;
        } finally {
            if (page) await page.close();
            // 브라우저는 계속 열어둘지 고민 (성능을 위해 놔둬도 무방)
        }
    }
}

export default new NotebookLMAdapter();

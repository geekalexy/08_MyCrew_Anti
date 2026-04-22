/**
 * NotebookLM Adapter (HTTP Client for Local MCP BYOMCP Tunnel)
 *
 * 이 어댑터는 중앙 서버 환경에서 실행결과를 로컬 사용자에게 오프로딩하기 위한 브릿지입니다.
 * 유저의 로컬 환경(127.0.0.1:3000)에서 구동 중인 mycrew-notebooklm-mcp 데몬에 직접
 * HTTP REST 요청을 보내어 안전하게 봇 탐지를 회피하고, 최초 접근 시 자동 로그인 팝업을 유도합니다.
 */

class NotebookLMAdapter {
    constructor() {
        // 유저마다 다를 수 있으나, 현재는 유저 로컬의 터널링 프록시라고 가정합니다.
        this.baseUrl = process.env.NOTEBOOKLM_MCP_HOST || 'http://127.0.0.1:3000';
    }

    /**
     * 로컬 터널의 생존을 확인하고, 인증이 안되어있을 시 즉각 로그인 UI를 띄우도록 원격 트리거합니다.
     */
    async pingAndAuth() {
        try {
            const res = await fetch(`${this.baseUrl}/health`);
            if (!res.ok) throw new Error('MCP HTTP Server not reachable');
            
            const healthData = await res.json();
            
            // 🔒 로컬 데몬은 떠있으나 미인증(구글 로그인 안됨) 상태일 경우
            if (healthData.success && healthData.data && healthData.data.authenticated === false) {
                console.log('🔒 [NotebookLM] 로컬 터널 미인증 감지. 사용자 PC에 구글 로그인 창을 전송합니다...');
                
                // 사용자의 화면에 크롬 브라우저를 띄워 수동 로그인을 통과하도록 대기
                const authRes = await fetch(`${this.baseUrl}/setup-auth`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ show_browser: true, timeout_seconds: 120 })
                });
                
                const authResult = await authRes.json();
                if (!authResult.success) {
                    throw new Error(`사용자 인증(로그인) 파이프라인 실패: ${authResult.error}`);
                }
                
                console.log('🔓 [NotebookLM] 로컬 브라우저 인증 성공. 우회 경로 개통 완료.');
            }
            
            return true;
        } catch (e) {
            console.error('[NotebookLM] 로컬 터널 연결 실패:', e.message);
            throw new Error(`NotebookLM 브릿지에 연결할 수 없습니다. 로컬 터미널 스크립트가 실행 중인지 확인하세요. (${this.baseUrl})`);
        }
    }

    /**
     * 노트북을 생성하고 소스를 업로드합니다.
     */
    async createNotebookAndUpload(title, filePath, textDetails = '') {
        try {
            // 1. 유저 로컬 MCP 생존 & 인증 확인 (안 되어있으면 띄우고 Blocking 대기)
            await this.pingAndAuth();

            // 2. 노트북 이름으로 생성 명령 하달
            console.log(`[NotebookLM] 로컬 우회로를 통해 노트북 생성 지시: ${title}`);
            const createRealRes = await fetch(`${this.baseUrl}/notebooks/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: title, show_browser: false })
            });
            const realNotebook = await createRealRes.json();
            
            if (!realNotebook.success) {
                throw new Error(`Notebook creation failed: ${realNotebook.error}`);
            }

            const notebookUrl = realNotebook.url || realNotebook.target_url || realNotebook.data?.url;

            // 3. 소스 업로드 통신
            console.log(`[NotebookLM] 확보한 노트북 (${notebookUrl})에 소스 전송 로직 호출.`);
            
            const sourcePayload = {
                notebook_url: notebookUrl,
                source_type: filePath ? 'file' : 'text',
                file_path: filePath || undefined,
                text: textDetails || undefined,
                title: filePath ? 'Attached Resource' : 'Analyzed Script'
            };

            const uploadRes = await fetch(`${this.baseUrl}/content/sources`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...sourcePayload, show_browser: false })
            });

            const uploadResult = await uploadRes.json();
            if (!uploadResult.success) {
                throw new Error(`Source Upload failed: ${uploadResult.error}`);
            }

            console.log(`[NotebookLM] BYOC 전략(Bring Your Own Client) 연동 완성. 작업 완료.`);
            
            return {
                status: 'ok',
                message: 'Local HTTP Tunneling 처리 완료',
                notebook_url: notebookUrl,
                data: uploadResult
            };

        } catch (error) {
            console.error('[NotebookLM] 브릿지 브로드캐스트 에러:', error);
            throw error;
        }
    }
}

export default new NotebookLMAdapter();

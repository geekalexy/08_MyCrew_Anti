import { useRef, useCallback } from 'react';
import { useChatStore } from '../store/chatStore';

// 타임아웃 매핑 테이블 (단위: 밀리초)
const TOOL_TIMEOUTS = {
  getTaskDetails: 15000,
  getCrewStatus: 15000,
  createKanbanTask: 30000,
  updateKanbanTask: 30000,
  deleteKanbanTask: 30000,
  googleSearch: 60000,
  naverSearch: 60000,
  run_command: 120000, // 터미널 등 장기 실행
  DEFAULT: 30000
};

export function useStreaming() {
  const abortControllerRef = useRef(null);
  const timeoutRef = useRef(null);
  const { setStreamingState, appendStreamingText, appendChat } = useChatStore();

  const clearToolTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const dangerouslyAbortStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    clearToolTimeout();
    setStreamingState(false, '');
  }, [setStreamingState]);

  const startStream = useCallback(async (url, payload, projectId) => {
    // 이전 스트림 중단
    dangerouslyAbortStream();

    abortControllerRef.current = new AbortController();
    setStreamingState(true, '');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify(payload),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let currentEvent = 'message';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // 마지막 불완전한 줄은 남김

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.substring(7).trim();
          } else if (line.startsWith('data: ')) {
            const dataStr = line.substring(6).trim();
            if (!dataStr) continue;

            let data;
            try {
              data = JSON.parse(dataStr);
            } catch (e) {
              continue; // JSON 파싱 실패 무시
            }

            if (currentEvent === 'tool:start') {
              // 타임아웃 타이머 시작
              clearToolTimeout();
              const timeoutMs = TOOL_TIMEOUTS[data.toolName] || TOOL_TIMEOUTS.DEFAULT;
              
              console.log(`[SSE] 🛠 도구 실행 시작: ${data.displayName} (${timeoutMs}ms 타임아웃)`);
              
              timeoutRef.current = setTimeout(() => {
                console.warn(`[SSE] ⚠️ 도구 실행 타임아웃: ${data.toolName}`);
              }, timeoutMs);

            } else if (currentEvent === 'tool:end') {
              clearToolTimeout();
              console.log(`[SSE] ✅ 도구 실행 완료: ${data.toolName} (${data.durationMs}ms)`);
            } else if (currentEvent === 'done') {
              clearToolTimeout();
              
              // 최종 텍스트를 chatStore의 chats 목록에 추가
              if (fullText.trim()) {
                appendChat({
                  level: 'info',
                  message: fullText,
                  agentId: 'ari',
                  timestamp: new Date().toISOString(),
                  projectId,
                });
              }
            } else if (currentEvent === 'error' || currentEvent === 'quota') {
              const errMsg = `\n[에러 발생: ${data.message}]`;
              appendStreamingText(errMsg);
              fullText += errMsg;
              clearToolTimeout();
              
              appendChat({
                level: 'error',
                message: data.message,
                agentId: 'system',
                timestamp: new Date().toISOString(),
                projectId,
              });
            } else {
              // 일반 텍스트 청크
              if (data.text) {
                appendStreamingText(data.text);
                fullText += data.text;
              }
            }
            
            // 이벤트 처리 후 초기화 (데이터가 없는 빈 줄에서 리셋되도록 해도 됨)
            currentEvent = 'message';
          }
        }
      }

      setStreamingState(false);
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('[SSE] 스트림 중단됨');
      } else {
        console.error('[SSE] 스트림 에러:', err);
        setStreamingState(false);
        // [Fix] Fetch 에러나 HTTP 500 에러 발생 시 UI에 에러 버블 표시
        appendChat({
          level: 'error',
          message: `스트림 연결에 실패했습니다: ${err.message}`,
          agentId: 'system',
          timestamp: new Date().toISOString(),
          projectId,
        });
      }
    } finally {
      clearToolTimeout();
      abortControllerRef.current = null;
    }
  }, [dangerouslyAbortStream, setStreamingState, appendStreamingText, appendChat]);

  return {
    startStream,
    dangerouslyAbortStream
  };
}

import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, AlertCircle } from 'lucide-react';
import { io } from 'socket.io-client';
import logoUrl from './logo.png';

function App() {
  const [messages, setMessages] = useState([
    { role: 'system', content: 'Antigravity Protocol Initialized. Connecting to server...' }
  ]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [selectedModel, setSelectedModel] = useState('anti-gemini-3.1-pro-high');
  const [pendingAction, setPendingAction] = useState(null);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const MODELS = [
    { id: 'anti-gemini-3.1-pro-high', name: 'Gemini 3.1 Pro (High) New' },
    { id: 'anti-gemini-3.1-pro-low', name: 'Gemini 3.1 Pro (Low) New' },
    { id: 'anti-gemini-3-flash', name: 'Gemini 3 Flash' },
    { id: 'anti-claude-sonnet-4.6-thinking', name: 'Claude Sonnet 4.6 (Thinking)' },
    { id: 'anti-claude-opus-4.6-thinking', name: 'Claude Opus 4.6 (Thinking)' },
    { id: 'anti-gpt-oss-120b', name: 'GPT-OSS 120B (Medium)' }
  ];

  useEffect(() => {
    socketRef.current = io('http://localhost:4010', {
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      setIsConnected(true);
      socketRef.current.emit('extension:load_history');
    });

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
      setMessages(prev => [...prev, { role: 'system', content: 'Connection lost. Reconnecting...' }]);
    });

    // ── [Sprint 7 — Step 3] Approval Gate 이벤트 수신 ────────
    socketRef.current.on('extension:confirm_action', (data) => {
      setPendingAction(data);
      if (data.responseText) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.responseText }]);
      }
    });

    socketRef.current.on('extension:reply', async (data) => {
      // [Sprint 6] Action 파싱 및 브라우저 제어 (DOM 제어)
      const actionRegex = /```(?:json)?\s*(\{\s*"action"[\s\S]*?\})\s*```/i;
      const actionMatch = data.text.match(actionRegex);
      
      // UI 폴리싱: 화면에 출력할 텍스트에서 JSON 블럭 제거
      let cleanText = data.text;
      if (actionMatch) {
        cleanText = data.text.replace(/```(?:json)?\s*\{\s*"action"[\s\S]*?\}\s*```/ig, '').trim();
        if (!cleanText) cleanText = '✨ 지정하신 액션을 실행했습니다!';
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: cleanText }]);
      
      if (actionMatch) {
        try {
          const actionData = JSON.parse(actionMatch[1]);
          console.log('[Extension] Executing Action:', actionData);
          if (typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting) {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs && tabs.length > 0) {
              await chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: (act) => {
                  try {
                    const el = document.querySelector(act.selector);
                    if (!el) return console.warn('Element not found:', act.selector);
                    
                    if (act.action === 'CLICK') {
                      el.click();
                    } else if (act.action === 'TYPE' && act.value !== undefined) {
                      // React 등 SPA 프레임워크 대응을 위한 네이티브 setter 호출
                      const tag = el.tagName.toLowerCase();
                      if (tag === 'textarea') {
                        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
                        if (nativeSetter) nativeSetter.call(el, act.value);
                        else el.value = act.value;
                      } else {
                        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                        if (nativeSetter) nativeSetter.call(el, act.value);
                        else el.value = act.value;
                      }
                      
                      el.dispatchEvent(new Event('input', { bubbles: true }));
                      el.dispatchEvent(new Event('change', { bubbles: true }));
                      
                      // 엔터키 자동 입력 (옵션)
                      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                    } else if (act.action === 'SCROLL') {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  } catch (err) {
                    console.error('Action error:', err);
                  }
                },
                args: [actionData]
              });
            }
          }
        } catch(e) {
          console.error('[Extension] Action parsing/execution failed:', e);
        }
      }
    });
    
    socketRef.current.on('extension:history_loaded', (loadedHistory) => {
      if (loadedHistory && loadedHistory.length > 0) {
        setMessages([
          { role: 'system', content: 'Connection established. History restored.' },
          ...loadedHistory
        ]);
      } else {
        setMessages([
          { role: 'system', content: 'Connection established. Ready.' }
        ]);
      }
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !isConnected) return;
    
    // 1. 현재 탭 정보 및 DOM 파싱 (Chrome API)
    let browserContext = { url: '로컬 테스트 (URL 없음)', title: '로컬 테스트', domSnapshot: '' };
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs.length > 0) {
          const tabId = tabs[0].id;
          
          // DOM 구조 스냅샷 추출 (상호작용 가능한 엘리먼트 위주)
          const domResult = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
              const elements = Array.from(document.querySelectorAll('button, a, input, textarea, select, [role="button"]'));
              return elements.map(el => {
                const tag = el.tagName.toLowerCase();
                const text = (el.innerText || el.placeholder || el.value || el.ariaLabel || '').trim().replace(/\n/g, ' ');
                if (!text) return null;
                
                // 안정적인 셀렉터 생성 시도
                let selector = '';
                if (el.id) selector = `#${el.id}`;
                else if (el.className && typeof el.className === 'string') {
                  const cls = el.className.split(' ').filter(c => c && !c.includes(':')).slice(0,2).join('.');
                  if (cls) selector = `${tag}.${cls}`;
                }
                if (!selector) selector = tag;
                
                return `[${tag}] "${text.substring(0, 50)}" (selector: ${selector})`;
              }).filter(Boolean).slice(0, 50).join('\n'); // 토큰 절약을 위해 최대 50개만
            }
          });

          browserContext = { 
            url: tabs[0].url, 
            title: tabs[0].title,
            domSnapshot: domResult[0]?.result || '상호작용 가능한 요소를 찾지 못했습니다.'
          };
        }
      }
    } catch (e) {
      console.warn("Chrome tabs API not available", e);
    }

    // 2. 히스토리 구성 (system 메시지 제외)
    const chatHistory = messages.filter(m => m.role !== 'system').slice(-6);
    
    // 3. UI 업데이트 및 전송
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    socketRef.current.emit('extension:chat', { 
      text: input, 
      model: selectedModel,
      history: chatHistory,
      browserContext: browserContext
    });
    setInput('');
  };

  // ── [Sprint 7 — Step 3] Approval Gate 핸들러 ────────
  const handleConfirmAction = (approved) => {
    if (!pendingAction || !isConnected) return;
    socketRef.current.emit('extension:confirm_action_response', {
      action: pendingAction.action,
      approved: approved
    });
    
    // UI에 사용자의 선택 표시
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: approved ? '[시스템 액션 승인됨]' : '[시스템 액션 거부됨]' 
    }]);
    
    setPendingAction(null);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#0a0a0a] text-gray-300 font-sans p-4">
      
      {/* Header & Model Switcher */}
      <div className="flex flex-col items-center mb-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
          <img src={logoUrl} alt="MyCrew Logo" className="w-full h-full object-contain rounded-xl" />
        </div>
        
        {/* Model Switcher Dropdown replacing the H1 */}
        <select 
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-[85%] max-w-[280px] bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm font-medium text-gray-200 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer mb-2 text-center"
          style={{ textAlignLast: 'center' }}
        >
          {MODELS.map(m => (
            <option key={m.id} value={m.id} className="text-left">{m.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
            {isConnected ? 'Connected' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Intro Card (Like the screenshot) */}
      {messages.length === 1 && (
        <div className="mb-6 mx-2 p-4 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] shadow-lg">
          <p className="text-base text-gray-400 leading-relaxed text-center">
            The agent can click, scroll, type, and navigate web pages automatically. While working, it displays an overlay showing its progress and provides controls to stop execution if you need to intervene.
          </p>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 px-2 scroll-smooth">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`
              max-w-[85%] rounded-lg text-base leading-relaxed
              ${msg.role === 'user' ? 'bg-[#1a1a1a] border border-[#333] text-gray-200 p-3' : ''}
              ${msg.role === 'assistant' ? 'text-gray-300 px-1 py-2' : ''}
              ${msg.role === 'system' ? 'w-full text-center text-sm text-blue-400 opacity-70 mb-2' : ''}
            `}>
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="relative mt-auto mx-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              handleSend();
            }
          }}
          placeholder="Ask Antigravity to do something..."
          className="w-full bg-[#1a1a1a] border border-[#333] text-white rounded-lg pl-4 pr-12 py-3 focus:outline-none focus:border-blue-500 transition-colors shadow-inner text-base placeholder-gray-500"
        />
        <button 
          onClick={handleSend}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-transparent text-gray-400 hover:text-white transition-colors"
        >
          <Send size={18} />
        </button>
      </div>

      {/* ── [Sprint 7 — Step 3] Approval Modal ──────── */}
      {pendingAction && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-5 shadow-2xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-3 text-amber-400">
              <AlertCircle size={24} />
              <h3 className="font-semibold text-xl">권한 승인 필요</h3>
            </div>
            <p className="text-gray-300 text-base mb-5 leading-relaxed">
              에이전트가 다음 마이크루 시스템 조작을 요청했습니다:<br/>
              <span className="inline-block mt-2 font-medium text-white bg-[#2a2a2a] px-3 py-1.5 rounded-md border border-[#444] w-full text-center">
                {pendingAction.description}
              </span>
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => handleConfirmAction(false)}
                className="flex-1 py-2.5 rounded-lg font-medium text-base border border-[#333] text-gray-400 hover:bg-[#2a2a2a] hover:text-white transition-colors"
              >
                거부 (Cancel)
              </button>
              <button 
                onClick={() => handleConfirmAction(true)}
                className="flex-1 py-2.5 rounded-lg font-medium text-base bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:shadow-[0_0_20px_rgba(37,99,235,0.6)] transition-all transform hover:-translate-y-0.5"
              >
                승인 (Confirm)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;

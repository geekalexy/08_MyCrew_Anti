import React, { useState } from 'react';
import { useUiStore } from '../../store/uiStore';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

export default function VideoLabView() {
  const { setCurrentView } = useUiStore();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  
  // ── Step 1 State (트렌드 서치) ───────────────────────────
  const [searchTopic, setSearchTopic] = useState('');
  const [targetFormat, setTargetFormat] = useState('shorts'); // 'shorts' | 'long'
  const [targetLengthMins, setTargetLengthMins] = useState('0');
  const [targetLengthSecs, setTargetLengthSecs] = useState('30');
  const [trendSummary, setTrendSummary] = useState('');
  const [discoveredVideos, setDiscoveredVideos] = useState([]);
  const [selectedUrls, setSelectedUrls] = useState([]); // 체크박스로 선택된 URLs

  // ── Step 2 State (스크립트 분석) ───────────────────────────
  const [urls, setUrls] = useState(['', '']); 
  const [analysisReport, setAnalysisReport] = useState('');
  const [transcripts, setTranscripts] = useState([]);
  // 에러 대비 폴백 (수동 자막)
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [fallbackScript, setFallbackScript] = useState('');

  // ── Step 3 & 4 State (생성/감수 및 교체) ───────────────────────────
  const [customInstructions, setCustomInstructions] = useState('');
  const [scriptScenes, setScriptScenes] = useState([]);
  const [scriptTitles, setScriptTitles] = useState([]); // 타이틀 후보 저장용
  const [regeneratingSceneId, setRegeneratingSceneId] = useState(null);

  const showToast = (msg, duration = 4000) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), duration);
  };

  // ─── Step 1 로직 ───
  const handleDiscoverTrend = async () => {
    if (!searchTopic.trim()) return showToast('주제나 키워드를 입력하세요.');
    setIsLoading(true);
    setTrendSummary('');
    setDiscoveredVideos([]);
    setSelectedUrls([]);
    
    try {
      const res = await fetch(`${SERVER_URL}/api/videolab/discover-trend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: targetFormat === 'shorts' ? searchTopic + ' #shorts' : searchTopic })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '검색 실패');
      
      if (!data.videos || data.videos.length === 0) {
        throw new Error('검색 결과가 없습니다.');
      }

      setTrendSummary(data.trendSummary);
      setDiscoveredVideos(data.videos);
    } catch (err) {
      showToast(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleVideoSelection = (url) => {
    setSelectedUrls(prev => 
        prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]
    );
  };

  const skipToStep2 = () => {
    setUrls(['', '']);
    setCurrentStep(2);
  };

  const proceedToStep2 = () => {
    if (selectedUrls.length < 2) return showToast('비교 분석을 위해 2개 이상의 영상을 선택하세요.');
    setUrls(selectedUrls);
    setCurrentStep(2);
  };

  // ─── Step 2 로직 ───
  const handleAddUrl = () => setUrls([...urls, '']);
  const handleRemoveUrl = (index) => {
    const newUrls = urls.filter((_, i) => i !== index);
    setUrls(newUrls.length > 0 ? newUrls : ['']);
  };
  const handleUrlChange = (index, value) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  const handleAnalyzeScript = async () => {
    const validUrls = urls.filter(u => u.trim());
    if (validUrls.length < 2 && !isFallbackMode) {
        return showToast('유튜브 링크를 2개 이상 입력하세요.');
    }
    
    setIsLoading(true);
    setAnalysisReport('');
    
    try {
      if (isFallbackMode) {
        if (!fallbackScript.trim()) throw new Error('수동 자막 스크립트를 입력해주세요.');
        setAnalysisReport(`수동 분석 모드: 사용자가 입력한 자막을 분석했습니다.\n\n${fallbackScript.slice(0, 100)}...`);
        setIsLoading(false);
        setCurrentStep(3);
        return;
      }

      const res = await fetch(`${SERVER_URL}/api/videolab/analyze-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: validUrls })
      });
      
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'TRANSCRIPT_EXTRACTION_FAILED') {
            setIsFallbackMode(true);
            showToast('자동 추출 실패! 비서 아리의 안내에 따라 스크립트를 수동으로 입력하세요.', 6000);
            setIsLoading(false);
            return;
        }
        throw new Error(data.error || '분석 실패');
      }
      
      setAnalysisReport(data.analysisReport);
      setTranscripts(data.transcripts);
      setCurrentStep(3);
      
    } catch (err) {
      showToast(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Step 3 로직 ───
  const handleGenerateScript = async () => {
    if (!analysisReport) return showToast('분석 리포트가 비어있습니다.');
    setIsLoading(true);
    try {
      const formattedInstructions = `[포맷 지시사항]
- 목표 영상 형식: ${targetFormat === 'shorts' ? '세로형 숏폼(9:16)' : '가로형 롱폼(16:9)'}
- 목표 전체 분량: 약 ${targetLengthMins}분 ${targetLengthSecs}초 내외

[추가 커스텀 지시자]
${customInstructions || '없음'}`;

      const res = await fetch(`${SERVER_URL}/api/videolab/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisReport, customInstructions: formattedInstructions })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '생성 실패');
      
      setScriptScenes(data.scriptScenes || []);
      setScriptTitles(data.scriptTitles || []);
      setCurrentStep(4);
    } catch (err) {
      showToast(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Step 4 씬 교체 로직 ───
  const handleRegenerateScene = async (sceneIdx) => {
    setRegeneratingSceneId(sceneIdx);
    try {
      const scene = scriptScenes[sceneIdx];
      const fullScriptStr = scriptScenes.map(s => `[Scene ${s.sceneId}] (${s.duration}초)\n텍스트: ${s.text}\n비주얼: ${s.visualPrompt}`).join('\n\n');
      
      const res = await fetch(`${SERVER_URL}/api/videolab/regenerate-scene`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalScene: scene,
          fullScriptStr,
          analysisReport,
          customInstructions: `목표: ${targetFormat === 'shorts' ? '세로형 숏폼' : '가로형 롱폼'}, 약 ${targetLengthMins}분 ${targetLengthSecs}초 분량.\n${customInstructions}`
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '씬 교체 실패');
      
      const newScenes = [...scriptScenes];
      newScenes[sceneIdx] = { ...scene, text: data.altScene.text, visualPrompt: data.altScene.visualPrompt };
      setScriptScenes(newScenes);
      showToast('해당 씬 내용이 새롭게 교체되었습니다!');
    } catch(err) {
      showToast(err.message);
    } finally {
      setRegeneratingSceneId(null);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 8000,
      background: 'var(--bg-base)', display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* ── 헤더 영역 ── */}
      <div style={{ height: '52px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 1.25rem' }}>
        <button onClick={() => setCurrentView('projects')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginRight: '1rem', display: 'flex', alignItems: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1rem', marginRight: '4px' }}>arrow_back</span> 대시보드
        </button>
        <div style={{ fontWeight: 700, fontSize: '1rem' }}>🎬 Video Lab <span style={{ color: '#4ade80' }}>v2.1 P&P</span></div>
        
        {toastMsg && (
          <div style={{ marginLeft: 'auto', background: 'rgba(238,42,123,0.1)', color: '#f472b6', padding: '4px 12px', borderRadius: '4px', fontSize: '0.8rem' }}>
            {toastMsg}
          </div>
        )}
      </div>

      {/* ── 본문 영역 (Wizard 레이아웃) ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* 사이드바 파이프라인 네비게이션 */}
        <div style={{ width: '250px', borderRight: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', padding: '1.5rem 1rem' }}>
          <h3 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Modular Pipeline</h3>
          {[
            { step: 1, title: '트렌드 발견 (Discovery)' },
            { step: 2, title: '스크립트 분석 (Extraction)' },
            { step: 3, title: '디렉팅 기획 (Generation)' },
            { step: 4, title: '씬 감수 (Review)' },
          ].map((item) => (
            <div key={item.step} style={{
              display: 'flex', alignItems: 'center', marginBottom: '1rem',
              color: currentStep === item.step ? '#fff' : (currentStep > item.step ? '#4ade80' : 'var(--text-muted)'),
              fontWeight: currentStep === item.step ? 700 : 400,
              opacity: currentStep < item.step ? 0.4 : 1
            }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: currentStep >= item.step ? 'rgba(100,100,246,0.2)' : 'transparent',
                border: `1px solid ${currentStep >= item.step ? '#6464F6' : 'var(--border)'}`,
                marginRight: '0.75rem', fontSize: '0.75rem'
              }}>
                {currentStep > item.step ? '✓' : item.step}
              </div>
              <span style={{ fontSize: '0.85rem' }}>{item.title}</span>
            </div>
          ))}
        </div>

        {/* 컨텐츠 워크스페이스 */}
        <div style={{ flex: 1, padding: '2.5rem', overflowY: 'auto' }}>
            
          {/* ================= STEP 1: 트렌드 검색 ================= */}
          {currentStep === 1 && (
            <div style={{ maxWidth: '900px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h1 style={{ fontSize: '1.8rem', color: '#fff' }}>유튜브 트렌드 서치</h1>
                  <button onClick={skipToStep2} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>건너뛰기 (직접 입력)</button>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                제작하고 싶은 카테고리나 주제를 입력하세요. 유튜브 내 최상위 트렌드 10건을 긁어오고 Gemini가 거시적 요약을 제공합니다.
              </p>
              <p style={{ color: '#f472b6', fontSize: '0.85rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>info</span>
                * 랭크는 단순 조회수 순이 아닌, 유튜브의 체류시간+키워드 매칭률+최근 업로드 속도+시청자 참여도 비율(Relevance)을 종합한 순위입니다.
              </p>
              
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                  <select
                      value={targetFormat}
                      onChange={e => setTargetFormat(e.target.value)}
                      style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', padding: '12px 16px', borderRadius: '8px', fontSize: '1rem', width: '120px' }}
                  >
                      <option value="shorts">📱 숏폼</option>
                      <option value="long">🖥️ 롱폼</option>
                  </select>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-base)', border: '1px solid var(--border)', padding: '0 12px', borderRadius: '8px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>목표 길이:</span>
                      <input 
                          type="number" min="0" max="59"
                          value={targetLengthMins}
                          onChange={e => setTargetLengthMins(e.target.value)}
                          style={{ width: '40px', background: 'transparent', border: 'none', color: '#fff', textAlign: 'right', fontSize: '1rem' }}
                      />
                      <span style={{ color: 'var(--text-muted)' }}>분</span>
                      <input 
                          type="number" min="0" max="59"
                          value={targetLengthSecs}
                          onChange={e => setTargetLengthSecs(e.target.value)}
                          style={{ width: '40px', background: 'transparent', border: 'none', color: '#fff', textAlign: 'right', fontSize: '1rem' }}
                      />
                      <span style={{ color: 'var(--text-muted)' }}>초</span>
                  </div>

                  <input 
                      type="text" 
                      placeholder="예) AI 에이전트, 뷰티 하울, 2026 테크 트렌드..." 
                      value={searchTopic}
                      onChange={e => setSearchTopic(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleDiscoverTrend()}
                      style={{ flex: 1, minWidth: '300px', background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', padding: '12px 16px', borderRadius: '8px', fontSize: '1rem' }}
                  />
                  <button 
                      onClick={handleDiscoverTrend} 
                      disabled={isLoading}
                      style={{ background: '#6464F6', color: '#fff', border: 'none', padding: '0 24px', borderRadius: '8px', fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                  >
                      {isLoading ? '검색 중...' : '트렌드 찾기'}
                  </button>
              </div>

              {trendSummary && (
                  <div style={{ background: 'rgba(74, 222, 128, 0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(74, 222, 128, 0.2)', marginBottom: '2rem' }}>
                      <h3 style={{ color: '#4ade80', marginBottom: '0.75rem', fontSize: '1rem' }}>💡 거시적 트렌드 요약 (Trend Summary)</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>{trendSummary}</p>
                  </div>
              )}

              {discoveredVideos.length > 0 && (
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                          <thead>
                              <tr style={{ background: 'rgba(255,255,255,0.03)', textAlign: 'left' }}>
                                  <th style={{ padding: '12px', borderBottom: '1px solid var(--border)', width: '50px' }}>선택</th>
                                  <th style={{ padding: '12px', borderBottom: '1px solid var(--border)', width: '60px' }}>랭크</th>
                                  <th style={{ padding: '12px', borderBottom: '1px solid var(--border)', width: '80px' }}>썸네일</th>
                                  <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>타이틀</th>
                                  <th style={{ padding: '12px', borderBottom: '1px solid var(--border)', width: '120px' }}>채널(저자)</th>
                                  <th style={{ padding: '12px', borderBottom: '1px solid var(--border)', width: '100px' }}>조회수</th>
                                  <th style={{ padding: '12px', borderBottom: '1px solid var(--border)', width: '80px' }}>링크</th>
                              </tr>
                          </thead>
                          <tbody>
                              {discoveredVideos.map((vid, idx) => (
                                  <tr key={idx} style={{ 
                                      borderBottom: '1px solid var(--border)', 
                                      background: selectedUrls.includes(vid.url) ? 'rgba(100,100,246,0.1)' : 'transparent',
                                      transition: 'background 0.2s'
                                  }}>
                                      <td style={{ padding: '12px' }}>
                                          <input 
                                              type="checkbox" 
                                              checked={selectedUrls.includes(vid.url)}
                                              onChange={() => toggleVideoSelection(vid.url)}
                                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                          />
                                      </td>
                                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{vid.rank}</td>
                                      <td style={{ padding: '12px' }}>
                                          <img src={vid.image || vid.thumbnail} alt="thumbnail" style={{ width: '64px', height: '36px', objectFit: 'cover', borderRadius: '4px' }} />
                                      </td>
                                      <td style={{ padding: '12px', color: '#fff', fontWeight: 500 }}>{vid.title}</td>
                                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{vid.author || '정보 없음'}</td>
                                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                                          {vid.views ? vid.views.toLocaleString() + '회' : '정보 없음'}
                                      </td>
                                      <td style={{ padding: '12px' }}>
                                          <a href={vid.url} target="_blank" rel="noreferrer" style={{ color: '#b4c5ff', textDecoration: 'none' }}>보기↗</a>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              )}

              {discoveredVideos.length > 0 && (
                  <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <button 
                          onClick={proceedToStep2}
                          style={{ background: 'linear-gradient(135deg, #10b981, #3b82f6)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                      >
                          선택한 {selectedUrls.length}개 영상으로 분석 진행하기 →
                      </button>
                  </div>
              )}
            </div>
          )}

          {/* ================= STEP 2: 자막 추출 및 훅 구조 분석 ================= */}
          {currentStep === 2 && (
            <div style={{ maxWidth: '800px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h1 style={{ fontSize: '1.8rem', color: '#fff' }}>스크립트 추출 및 훅(Hook) 분석</h1>
                  <button onClick={() => setCurrentStep(1)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>← 트렌드 검색으로 돌아가기</button>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
                선택된 유튜브 레퍼런스 영상들의 자막을 추출하고, 도입부부터 결론까지 시청자를 붙잡는 공통 '훅(Hook)' 모수를 심층 분석합니다.
              </p>
              
              {!isFallbackMode ? (
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>분석 대상 URL 리스트</span>
                      <button onClick={handleAddUrl} style={{ background: 'rgba(100,100,246,0.15)', color: '#b4c5ff', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>+ URL 추가</button>
                    </div>
                    {urls.map((url, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <input
                          type="text"
                          placeholder="https://youtube.com/watch?v=..."
                          value={url}
                          onChange={(e) => handleUrlChange(idx, e.target.value)}
                          style={{ flex: 1, background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', padding: '10px 12px', borderRadius: '6px', fontSize: '0.9rem' }}
                        />
                        <button onClick={() => handleRemoveUrl(idx)} style={{ background: 'rgba(255,100,100,0.1)', color: '#ff6b6b', border: 'none', padding: '0 15px', borderRadius: '6px', cursor: 'pointer' }}>삭제</button>
                      </div>
                    ))}
                  </div>
              ) : (
                  <div style={{ background: 'rgba(238,42,123,0.05)', border: '1px solid rgba(238,42,123,0.3)', padding: '1.5rem', borderRadius: '12px' }}>
                    <h3 style={{ color: '#f472b6', marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
                      <span className="material-symbols-outlined" style={{ marginRight: '8px' }}>support_agent</span>
                      비서 아리 안내 (Fallback Mode)
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                      말씀하신 영상들의 자막을 유튜브 API를 통해 자동으로 가져오는데 실패했습니다!<br/>
                      번거로우시겠지만 아래 <strong>대상 영상 열기</strong> 링크를 눌러 영상 하단 설명란의 <strong>[... 더보기] 클릭 → 하단으로 내려가 [스크립트 표시] 버튼</strong>을 클릭해서 자막 전체를 복사하여 아래에 붙여넣어 주시면 분석해 드릴게요.
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.15)', borderRadius: '8px' }}>
                      <h4 style={{ width: '100%', margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>선택된 수동 추출 대상 링크:</h4>
                      {urls.filter(u=>u.trim()).map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer" style={{ color: '#b4c5ff', textDecoration: 'none', background: 'rgba(100,100,246,0.1)', padding: '6px 12px', borderRadius: '4px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>open_in_new</span>
                          영상 {i+1} 열기
                        </a>
                      ))}
                    </div>
                    <textarea 
                        value={fallbackScript}
                        onChange={(e) => setFallbackScript(e.target.value)}
                        placeholder="복사한 여러 영상의 스크립트를 여기에 붙여넣어 주세요..."
                        style={{ width: '100%', minHeight: '200px', background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', padding: '1rem', borderRadius: '8px', fontFamily: 'monospace' }}
                    />
                  </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button 
                  onClick={handleAnalyzeScript} 
                  disabled={isLoading}
                  style={{
                    padding: '12px 24px', fontSize: '1rem', fontWeight: 600,
                    background: isLoading ? 'var(--border)' : 'linear-gradient(135deg, #10b981, #3b82f6)',
                    color: '#fff', border: 'none', borderRadius: '8px', cursor: isLoading ? 'not-allowed' : 'pointer', flex: 1
                  }}
                >
                  {isLoading ? '분석 중...' : (isFallbackMode ? '수동 텍스트로 분석 시작' : '자막 자동 추출 및 후킹 분석')}
                </button>
                {analysisReport && (
                  <button
                    onClick={() => setCurrentStep(3)}
                    disabled={isLoading}
                    style={{
                      padding: '12px 24px', fontSize: '1rem', fontWeight: 600,
                      background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', flex: 1
                    }}
                  >
                    기존 분석 결과 보기 →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ================= STEP 3: 인사이트 확인 및 기획 지시 ================= */}
          {currentStep === 3 && (
            <div style={{ maxWidth: '900px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h1 style={{ fontSize: '1.8rem', color: '#fff' }}>인사이트 리포트 & 기획 디렉팅</h1>
                  <button onClick={() => setCurrentStep(2)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>← 재분석</button>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ color: '#4ade80', margin: 0, fontSize: '1rem' }}>📈 Gemini 2.5 Pro 심층 분석 리포트</h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => { navigator.clipboard.writeText(analysisReport); showToast('클립보드에 복사되었습니다.'); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>content_copy</span> 복사
                    </button>
                    <button onClick={() => {
                      const el = document.createElement("a");
                      const file = new Blob([analysisReport], {type: 'text/plain'});
                      el.href = URL.createObjectURL(file);
                      el.download = `${searchTopic || 'analysis'}_report.txt`;
                      document.body.appendChild(el);
                      el.click();
                      document.body.removeChild(el);
                      showToast('리포트 파일로 다운로드되었습니다.');
                    }} style={{ background: 'rgba(100,100,246,0.2)', border: 'none', color: '#b4c5ff', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>download</span> 저장
                    </button>
                  </div>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, maxHeight: '300px', overflowY: 'auto', paddingRight: '1rem' }}>
                  {analysisReport}
                </div>
              </div>

              <div style={{ background: 'rgba(100,100,246,0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(100,100,246,0.2)' }}>
                <h3 style={{ color: '#b4c5ff', marginBottom: '1rem', fontSize: '1rem' }}>🎬 우리 브랜드 영상 컨셉 및 지시어 (Prompt)</h3>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="예: 뷰티 제품 홍보를 위한 밝은 분위기로 만들어줘, 30초 내외로 해줘."
                  style={{ width: '100%', minHeight: '80px', background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem' }}
                />
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button 
                    onClick={handleGenerateScript} 
                    disabled={isLoading}
                    style={{
                      padding: '12px 24px', fontSize: '0.95rem', fontWeight: 600,
                      background: isLoading ? 'var(--border)' : '#6464F6', color: '#fff', border: 'none', borderRadius: '8px', cursor: isLoading ? 'not-allowed' : 'pointer', flex: 1
                    }}
                  >
                    {isLoading ? '스크립트 생성 중...' : '분석 기반 씬(Scene) 단위 스크립트 작성'}
                  </button>
                  {scriptScenes && scriptScenes.length > 0 && (
                    <button
                      onClick={() => setCurrentStep(4)}
                      disabled={isLoading}
                      style={{
                        padding: '12px 24px', fontSize: '0.95rem', fontWeight: 600,
                        background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', flex: 1
                      }}
                    >
                      기존 작성 스크립트 보기 →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 4: 씬 스크립트 감수 (Review) ================= */}
          {currentStep === 4 && (
            <div style={{ maxWidth: '1000px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h1 style={{ fontSize: '1.8rem', color: '#fff' }}>최종 씬 스크립트 감수</h1>
                  <button onClick={() => setCurrentStep(3)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>← 뒤로</button>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                AI가 작성해 준 스크립트입니다. 여기서 직접 내용을 수정하고 저장할 수 있습니다. <br/>
                <span style={{ color: '#f472b6' }}>* 노트북 LM 슬라이드 파이프라인 연계 준비 완료</span>
              </p>

              {scriptTitles && scriptTitles.length > 0 && (
                <div style={{ background: 'rgba(249,206,52,0.05)', border: '1px solid rgba(249,206,52,0.2)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
                  <h3 style={{ color: '#F9CE34', fontSize: '0.95rem', marginBottom: '0.75rem', marginTop: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>lightbulb</span>
                    AI 추천 타이틀 (Hook)
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#fff', fontSize: '0.9rem', lineHeight: 1.6 }}>
                    {scriptTitles.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              )}

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px', width: '80px', color: 'var(--text-muted)' }}>Scene</th>
                      <th style={{ padding: '12px', width: '80px', color: 'var(--text-muted)' }}>초(s)</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>내래이션 / 자막 텍스트</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>이미지/비주얼 지시사항</th>
                      <th style={{ padding: '12px', width: '70px', color: 'var(--text-muted)', textAlign: 'center' }}>교체</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scriptScenes.map((scene, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                        <td style={{ padding: '16px', fontWeight: 600 }}>{scene.sceneId || idx + 1}</td>
                        <td style={{ padding: '16px', color: '#4ade80' }}>
                          <input type="text" defaultValue={scene.duration} style={{ width: '40px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: '#4ade80', padding: '4px', borderRadius: '4px', textAlign: 'center' }} />초
                        </td>
                        <td style={{ padding: '16px' }}>
                          <textarea 
                              defaultValue={scene.text} 
                              key={`text-${idx}-${scene.text}`}
                              style={{ width: '100%', minHeight: '60px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: '#fff', padding: '8px', borderRadius: '4px', fontSize: '0.85rem' }} 
                          />
                        </td>
                        <td style={{ padding: '16px' }}>
                          <textarea 
                              defaultValue={scene.visualPrompt} 
                              key={`visual-${idx}-${scene.visualPrompt}`}
                              style={{ width: '100%', minHeight: '60px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: '#b4c5ff', padding: '8px', borderRadius: '4px', fontSize: '0.85rem' }} 
                          />
                        </td>
                        <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <button 
                            onClick={() => handleRegenerateScene(idx)}
                            disabled={regeneratingSceneId === idx}
                            style={{ background: 'rgba(238,42,123,0.1)', color: '#f472b6', border: '1px solid rgba(238,42,123,0.3)', padding: '8px', borderRadius: '8px', cursor: regeneratingSceneId === idx ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="이 씬만 AI로 새롭게 다시 생성교체"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', animation: regeneratingSceneId === idx ? 'spin 1s linear infinite' : 'none' }}>
                              {regeneratingSceneId === idx ? 'hourglass_empty' : 'autorenew'}
                            </span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button 
                  onClick={async () => {
                    if (!scriptScenes || scriptScenes.length === 0) return showToast('스크립트가 비어있습니다.');
                    try {
                      setIsLoading(true);
                      const res = await fetch(`${SERVER_URL}/api/videolab/save-script`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: searchTopic || 'Video Lab 추출물', scriptScenes })
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error);
                      showToast('✅ 로컬 서버(outputs/video-scripts)에 저장 완료!');
                    } catch (err) {
                      showToast(err.message);
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                  style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: isLoading ? 'not-allowed' : 'pointer' }}
                >
                  저장만 하기
                </button>
                <button 
                  onClick={async () => {
                    if (!scriptScenes || scriptScenes.length === 0) return showToast('스크립트가 비어있습니다.');
                    setIsLoading(true);
                    try {
                      showToast('노트북 LM 연동 중... (시간이 걸릴 수 있습니다)', 10000);
                      const res = await fetch(`${SERVER_URL}/api/videolab/export-notebooklm`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: searchTopic || 'Video Lab 추출물', scriptScenes })
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || '노트북 LM 연동 실패');
                      showToast('✅ 노트북 LM 노트북 생성 및 요약 오디오 요청 완료!', 5000);
                    } catch (err) {
                      showToast(err.message);
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                  style={{ background: 'linear-gradient(135deg, #f472b6, #e81cff)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 600, cursor: isLoading ? 'wait' : 'pointer' }}
                >
                  {isLoading ? '노트북 LM으로 전송 중...' : '노트북 LM 슬라이드 & 오디오 생성 연동'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

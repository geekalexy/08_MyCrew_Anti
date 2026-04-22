import React, { useState, useEffect } from 'react';
import { useUiStore } from '../../store/uiStore';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

const CHANNELS = [
  {
    id: 'finance-viral',
    title: '바이럴 지식/금융 채널',
    description: '어그로와 도파민을 극대화하는 매운맛 하드코어 정보 전달',
    operator: 'PICO 🍟',
    operatorImg: '/assets/pico.png', // Fallback or mock
    themeColor: '#111827',
    badge: '메가 히트 포맷'
  },
  {
    id: 'ai-tips',
    title: 'AI 꿀팁 정보 채널',
    description: '밝고 산뜻하게 알려주는 직장인 맞춤형 AI 효율 향상 꿀팁',
    operator: 'FLO 🌸',
    operatorImg: '/assets/ari.png', // Fallback or mock
    themeColor: '#3B82F6',
    badge: '신규 런칭'
  },
  {
    id: 'legacy-lab',
    title: '🧪 수동 기획 실험실 (Legacy)',
    description: '유튜브 링크 수동 2개 비교 분석 및 16:9 롱폼 스크립트 작성 (Notebook LM 연동)',
    operator: 'Human (수동)',
    operatorImg: '',
    themeColor: '#6B7280',
    badge: 'Classic Mode'
  }
];

export default function VideoLabView() {
  const { setCurrentView } = useUiStore();
  
  // UI States
  const [viewState, setViewState] = useState('CHANNELS'); // CHANNELS -> AUTOMATING -> RESULT
  const [selectedChannel, setSelectedChannel] = useState(null);
  
  // Automation Dashboard States
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [generatedImages, setGeneratedImages] = useState([]); // 워크플로우 중 생성된 이미지 썸네일 노출용

  const addLog = (msg) => setLogs(prev => [...prev, msg]);

  // 자동화 시뮬레이션 훅
  useEffect(() => {
    if (viewState !== 'AUTOMATING' || !selectedChannel) return;

    let isMounted = true;
    (async () => {
      // 단계 1: 시나리오 기획
      setProgress(10);
      addLog('🎬 [1단계] 트렌드 키워드 서치 및 30초 대본 기획 시작...');
      await new Promise(r => setTimeout(r, 2000));
      if (!isMounted) return;
      addLog('✅ 대본(Hook -> Problem -> Proof -> Climax -> CTA) 작성 완료.');
      
      // 단계 2: 이미지 랩 호출 (시나리오 맞춤 이미지 생성)
      setProgress(30);
      addLog('✨ [2단계] Image Lab 파이프라인 연동: 씬 별 맞춤 컨셉 이미지 생성 중...');
      await new Promise(r => setTimeout(r, 2000));
      if (!isMounted) return;
      setGeneratedImages(['🔥', '📉']);
      addLog('✅ 장면 1, 2 시각화 에셋 생성 완료.');
      await new Promise(r => setTimeout(r, 1500));
      if (!isMounted) return;
      setGeneratedImages(['🔥', '📉', '🕵️‍♂️', '🚀', '🎯']);
      addLog('✅ 총 5장의 고퀄리티 컨셉 이미지 렌더링 완료.');

      // 단계 3: 모션 그래픽 렌더링 (Remotion + VTuber)
      setProgress(60);
      addLog(`🎥 [3단계] 채널 운영자 [${selectedChannel.operator}] 캐릭터 매핑 및 모션 그래픽 렌더링 중...`);
      await new Promise(r => setTimeout(r, 2500));
      if (!isMounted) return;
      addLog('✅ 100% - 동영상 인코딩 및 모션 자막 합성 완료.');
      setProgress(90);

      // 단계 4: 유튜브 발행 대기
      await new Promise(r => setTimeout(r, 1000));
      if (!isMounted) return;
      setProgress(100);
      addLog('🚀 모든 자동화 파이프라인 처리가 완료되었습니다.');

      setTimeout(() => {
        if (isMounted) setViewState('RESULT');
      }, 1500);
    })();

    return () => { isMounted = false; };
  }, [viewState, selectedChannel]);

  const handleStartAutomation = (channel) => {
    if (channel.id === 'legacy-lab') {
      alert("이전 수동 기획(롱폼 지원) 버전의 스크립트 에디터로 전환합니다.");
      // 임시로 메시지만 띄움. 실제 라우팅 시 컴포넌트 마운트 로직 적용
      // setCurrentView('video_lab_legacy');  /* 예시 */
      return;
    }
    setSelectedChannel(channel);
    setLogs([]);
    setProgress(0);
    setGeneratedImages([]);
    setViewState('AUTOMATING');
  };

  const resetWorkspace = () => {
    setSelectedChannel(null);
    setViewState('CHANNELS');
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
        <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🎬 Video Lab <span style={{ background: '#4ade80', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>v3.0 Auto Studio</span>
        </div>
      </div>

      {/* ── 본문 영역 ── */}
      <div style={{ flex: 1, padding: '3rem', overflowY: 'auto' }}>
        
        {/* VIEW 1: 채널 선택 (템플릿 시작점) */}
        {viewState === 'CHANNELS' && (
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <h1 style={{ fontSize: '2.5rem', color: '#fff', marginBottom: '1rem', fontWeight: 900 }}>운영할 채널 포맷을 선택하세요</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
                채널 타겟에 맞춘 프롬프트 서치부터 이미지 렌더링, 영상 추출까지 1-Click 풀 자동화로 진행됩니다.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
              {CHANNELS.map(ch => (
                <div 
                  key={ch.id}
                  onClick={() => handleStartAutomation(ch)}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `2px solid ${ch.themeColor}`,
                    borderRadius: '16px',
                    padding: '2rem',
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                    e.currentTarget.style.boxShadow = `0 20px 40px ${ch.themeColor}33`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: ch.themeColor, color: '#fff', fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: '20px' }}>
                    {ch.badge}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--border)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.5rem', overflow: 'hidden' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '2rem', color: ch.themeColor }}>person</span>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>가상 운영자</div>
                      <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.2rem' }}>{ch.operator}</div>
                    </div>
                  </div>

                  <h2 style={{ fontSize: '1.5rem', color: '#fff', marginBottom: '1rem' }}>{ch.title}</h2>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '2rem' }}>{ch.description}</p>
                  
                  <div style={{ background: ch.themeColor, color: '#fff', textAlign: 'center', padding: '12px', borderRadius: '8px', fontWeight: 700 }}>
                    이 포맷으로 숏폼 뚝딱 만들기 →
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 2: 워크플로우 자동화 진행 화면 */}
        {viewState === 'AUTOMATING' && selectedChannel && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.8rem', color: '#fff', marginBottom: '2rem', textAlign: 'center' }}>
              [{selectedChannel.title}] 콘텐츠 전자동 생성 중 🤖
            </h2>

            {/* 시나리오 연상 이미지 (생성 실시간 표시) */}
            <div style={{ marginBottom: '2rem', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>🖼️ 실시간 컨셉 이미지 렌더링 버퍼 (Image Lab 연동)</div>
              <div style={{ display: 'flex', gap: '1rem', minHeight: '80px', alignItems: 'center' }}>
                {generatedImages.length === 0 ? (
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>대본 분석 후 이미지를 생성합니다...</span>
                ) : (
                  generatedImages.map((img, i) => (
                    <div key={i} style={{ width: '80px', height: '80px', background: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '8px', fontSize: '3rem', boxShadow: '0 10px 20px rgba(0,0,0,0.3)', animation: 'popIn 0.3s ease-out' }}>
                      {img}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 프로그래스 바 */}
            <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden', marginBottom: '2rem' }}>
              <div style={{ 
                height: '100%', 
                background: selectedChannel.themeColor,
                width: `${progress}%`,
                transition: 'width 0.5s ease-out'
              }} />
            </div>

            {/* 터미널 로그 */}
            <div style={{ background: '#09090b', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', fontFamily: 'monospace', fontSize: '0.9rem', color: '#10b981', minHeight: '300px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {logs.map((log, idx) => (
                <div key={idx} style={{ opacity: idx === logs.length - 1 ? 1 : 0.6 }}>
                  <span style={{ color: '#64748b' }}>[{new Date().toLocaleTimeString()}]</span> {log}
                </div>
              ))}
              {progress < 100 && (
                <div style={{ color: '#f472b6', animation: 'pulse 1.5s infinite' }}>
                  _ 처리 중...
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: 결과물 확인 */}
        {viewState === 'RESULT' && selectedChannel && (
          <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(74, 222, 128, 0.2)', color: '#4ade80', marginBottom: '1.5rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '2rem' }}>check</span>
            </div>
            <h2 style={{ fontSize: '2rem', color: '#fff', marginBottom: '2rem' }}>영상 렌더링이 완료되었습니다!</h2>

            <div style={{ display: 'flex', gap: '3rem', justifyContent: 'center', alignItems: 'flex-start' }}>
              {/* 비디오 플레이어 Mock */}
              <div style={{ width: '315px', height: '560px', background: '#000', borderRadius: '24px', border: `4px solid ${selectedChannel.themeColor}`, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '4rem', color: '#fff', opacity: 0.5, marginBottom: '1rem' }}>play_circle</span>
                <span style={{ color: 'var(--text-muted)' }}>{selectedChannel.title} MP4</span>
              </div>

              {/* 액션 패널 */}
              <div style={{ width: '350px', textAlign: 'left', background: 'rgba(255,255,255,0.02)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <h3 style={{ color: '#fff', marginBottom: '1.5rem', fontSize: '1.2rem' }}>🚀 다음 액션</h3>
                
                <button style={{ width: '100%', padding: '14px', background: '#ff0000', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-outlined">youtube_activity</span>
                  내 유튜브 채널에 바로 업로드
                </button>

                <button style={{ width: '100%', padding: '14px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, marginBottom: '2rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-outlined">download</span>
                  MP4 다운로드
                </button>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                  <button onClick={resetWorkspace} style={{ width: '100%', padding: '14px', background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>
                    돌아가서 다른 영상 만들기 ↺
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

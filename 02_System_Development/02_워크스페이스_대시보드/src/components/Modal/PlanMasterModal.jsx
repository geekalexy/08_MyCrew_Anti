import React, { useState } from 'react';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4010';

export default function PlanMasterModal({ onClose, projectId, taskId, onSubmit }) {
  const [req, setReq] = useState('');
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState(null);
  const [step, setStep] = useState(1);
  const [roadmap, setRoadmap] = useState(null);
  const [feedback, setFeedback] = useState('');

  const updateTaskStatus = async (status) => {
    if (!taskId) return;
    try {
      await fetch(`${SERVER_URL}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
    } catch (e) {
      console.warn('Failed to update task status:', e);
    }
  };

  const handleAnalyze = async () => {
    if (!req.trim()) return;
    setLoading(true);
    // [USER 피드백] 분석 시작하면 진행 컬럼(IN_PROGRESS) 이동
    await updateTaskStatus('IN_PROGRESS');
    
    try {
      const res = await fetch(`${SERVER_URL}/api/projects/${projectId}/plan-master/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirements: req, deadline })
      });
      const data = await res.json();
      
      if (data.status === 'needs_clarification') {
        setOptions(data.options);
      } else {
        await generateRoadmaps(data);
      }
    } catch (err) {
      console.error(err);
      alert('분석 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateRoadmaps = async (analyzeData) => {
    setLoading(true);
    try {
      const payload = { ...analyzeData };
      if (feedback.trim()) payload.feedback = feedback;

      const res = await fetch(`${SERVER_URL}/api/projects/${projectId}/plan-master/generate-roadmaps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setRoadmap(data);
        setStep(2);
        setFeedback('');
        // [USER 피드백] 완료되면 리뷰컬럼(REVIEW) 이동
        await updateTaskStatus('REVIEW');
      } else {
        throw new Error(data.error || '로드맵 생성 실패');
      }
    } catch (err) {
      console.error(err);
      alert('로드맵 생성 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    // [USER 피드백] 최종 컨펌 카드는 파이널(FINAL) 컬럼으로 이동
    await updateTaskStatus('FINAL');
    onSubmit && onSubmit(roadmap);
    onClose();
  };

  const handleSelectOption = (opt) => {
    setReq(prev => prev + '\n\n[선택된 구체화 방향]: ' + opt);
    setOptions(null);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }} onClick={onClose}>
      <div style={{
        background: '#1e1e1e', width: '600px', borderRadius: '12px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.4)', border: '1px solid #333',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', color: '#eee'
      }} onClick={e => e.stopPropagation()}>
        
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #333',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#252525'
        }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🚀 Plan Master 스코프 분석기
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {step === 1 && (
            <>
              <div>
                <label style={{ fontSize: '13px', color: '#ccc', fontWeight: 500, marginBottom: '4px', display: 'block' }}>요구사항 (Requirements)</label>
                <textarea 
                  placeholder="예: 결제 기능이 포함된 쇼핑몰 MVP를 만들어줘."
                  value={req} onChange={e => setReq(e.target.value)}
                  disabled={loading}
                  style={{ width: '100%', height: '120px', padding: '12px', background: '#111', border: '1px solid #333', borderRadius: '8px', color: '#eee', fontFamily: 'inherit', fontSize: '14px', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', color: '#ccc', fontWeight: 500, marginBottom: '4px', display: 'block' }}>개발 완료 희망 예정일</label>
                <input 
                  type="text" placeholder="예: 2주 이내, 11월 말까지 등"
                  value={deadline} onChange={e => setDeadline(e.target.value)}
                  disabled={loading}
                  style={{ width: '100%', padding: '12px', background: '#111', border: '1px solid #333', borderRadius: '8px', color: '#eee', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
                <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>💡 개발 완료 희망 기간은 AI의 깊이 있는 기획(Plan Thinking)과 적정 스코프 산정에 큰 도움이 됩니다.</div>
              </div>

              {options && options.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px', background: '#1a1a1a', padding: '16px', borderRadius: '8px', border: '1px dashed #444' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px', display: 'block', color: '#ffb347' }}>⚠️ 요구사항이 다소 포괄적입니다. 아래 방향 중 하나를 선택해 구체화해 보세요.</label>
                  {options.map((opt, i) => (
                    <button key={i} onClick={() => handleSelectOption(opt)} style={{ background: '#2a2a2a', color: '#ddd', border: '1px solid #444', padding: '12px', borderRadius: '6px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', fontSize: '13px' }}>
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 2 && roadmap && (
            <>
              <div style={{ background: '#1a1a1a', padding: '16px', borderRadius: '8px', border: '1px solid #333' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px', display: 'block', color: '#4ade80' }}>✨ Plan Master 제안 (Confirm MVP)</label>
                <p style={{ fontSize: '14px', lineHeight: '1.6', marginTop: '8px' }}>
                  {roadmap.message_to_user}
                </p>
                <div style={{ marginTop: '16px' }}>
                  <label style={{ fontSize: '13px', color: '#ccc', fontWeight: 500, marginBottom: '4px', display: 'block' }}>✅ MVP 태스크 (우선 구현)</label>
                  <ul style={{ margin: '8px 0 0 20px', padding: 0, fontSize: '13px', color: '#ccc' }}>
                    {roadmap.mvp_tasks?.map((t, idx) => <li key={idx} style={{ marginBottom: '4px' }}>{t}</li>)}
                  </ul>
                </div>
                <div style={{ marginTop: '16px' }}>
                  <label style={{ fontSize: '13px', color: '#ccc', fontWeight: 500, marginBottom: '4px', display: 'block' }}>🔮 Future Scope (추후 확장)</label>
                  <ul style={{ margin: '8px 0 0 20px', padding: 0, fontSize: '13px', color: '#888' }}>
                    {roadmap.future_scope?.map((t, idx) => <li key={idx} style={{ marginBottom: '4px' }}>{t}</li>)}
                  </ul>
                </div>
              </div>
              
              <div>
                <label style={{ fontSize: '13px', color: '#ccc', fontWeight: 500, marginBottom: '4px', display: 'block' }}>💬 추가 피드백 (수정 요청 시 작성)</label>
                <textarea 
                  placeholder="예: 결제보다는 소셜 로그인을 MVP에 포함해주세요."
                  value={feedback} onChange={e => setFeedback(e.target.value)}
                  disabled={loading}
                  style={{ width: '100%', height: '80px', padding: '12px', background: '#111', border: '1px solid #333', borderRadius: '8px', color: '#eee', fontFamily: 'inherit', fontSize: '14px', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </>
          )}

        </div>
        
        <div style={{ padding: '16px 20px', borderTop: '1px solid #333', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#252525' }}>
          <button onClick={onClose} style={{ background: 'transparent', color: '#aaa', border: '1px solid #444', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>취소</button>
          
          {step === 1 && !options && (
            <button onClick={handleAnalyze} disabled={!req.trim() || loading} style={{ background: (!req.trim() || loading) ? '#7c6ef880' : '#7c6ef8', color: '#fff', border: 'none', padding: '8px 24px', borderRadius: '6px', fontWeight: 600, cursor: (!req.trim() || loading) ? 'not-allowed' : 'pointer' }}>
              {loading ? '분석 중...' : '스코프 분석 시작'}
            </button>
          )}
          
          {step === 2 && (
            <>
              <button onClick={() => generateRoadmaps(roadmap)} disabled={!feedback.trim() || loading} style={{ background: (!feedback.trim() || loading) ? '#333' : '#444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: (!feedback.trim() || loading) ? 'not-allowed' : 'pointer' }}>
                {loading ? '반영 중...' : '피드백 반영 (재기획)'}
              </button>
              <button onClick={handleConfirm} disabled={loading} style={{ background: loading ? '#7c6ef880' : '#7c6ef8', color: '#fff', border: 'none', padding: '8px 24px', borderRadius: '6px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
                이대로 확정 (Confirm)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

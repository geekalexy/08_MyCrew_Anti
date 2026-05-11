// src/components/Recruit/RecruitTalentModal.jsx
// PRD: 팀빌딩_PRD_Luca.md — Luca 기획, 구현
import { useState } from 'react';
import { useAgentStore } from '../../store/agentStore';

/* ─── Mock Roster Pool ─────────────────────────────────────────────── */
const ROSTER_POOL = [
  {
    id: 'lumi', name: 'LUMI', role: '비주얼 디자이너',
    category: '디자인',
    skills: ['Midjourney', 'Remotion', 'Figma'],
    model: 'Claude Sonnet',
    avatar: '/avatars/lumi.svg',
    emoji: '🎨',
    tagline: '"스크롤을 멈추게 하는 첫 프레임을 설계합니다."',
    description: 'AI 이미지/영상 프롬프트 엔지니어링부터 플랫폼별 비율 규격 관리까지. 비주얼 임팩트 극대화가 핵심 가치입니다.',
    strengths: ['Midjourney 프롬프트 최적화', 'Pollinations AI 즉시 렌더링', '플랫폼별 규격 완벽 준수'],
    color: '#c084fc',
  },
  {
    id: 'pico', name: 'PICO', role: '카피라이터',
    category: '마케팅',
    skills: ['Copywriting', 'SEO', 'Data Analysis'],
    model: 'Gemini Pro',
    avatar: '/avatars/pico.svg',
    emoji: '✍️',
    tagline: '"3초 Hook으로 엄지를 멈춥니다."',
    description: '인스타그램 캡션부터 30초 릴스 대본까지. 플랫폼별 바이럴 트리거 언어와 해시태그 3단계 전략을 구사합니다.',
    strengths: ['릴스 초 단위 대본 작성', '바이럴 트리거 언어 10종', '해시태그 대·중·소 전략'],
    color: '#6487f2',
  },
  {
    id: 'nova', name: 'NOVA', role: '전략 마케터',
    category: '마케팅',
    skills: ['SNS 전략', 'Hook 기획', '콘텐츠 피라미드'],
    model: 'Gemini Pro',
    avatar: '/avatars/nova.svg',
    emoji: '🚀',
    tagline: '"콘텐츠 피라미드로 채널을 장악합니다."',
    description: 'FOMO·밴드왜건 심리학 기반 마케팅 전략 수립. 블로그 1편에서 릴스 2편·캐러셀 1편의 자동 파생 구조를 설계합니다.',
    strengths: ['3초 Hook 5가지 공식', '콘텐츠 피라미드 자동 설계', '플랫폼 알고리즘 최적화'],
    color: '#ffb963',
  },
  {
    id: 'ollie', name: 'OLLIE', role: '데이터 전략가',
    category: '데이터분석',
    skills: ['KPI 분석', 'A/B 테스트', '역설계'],
    model: 'Claude Opus',
    avatar: '/avatars/ollie.svg',
    emoji: '📊',
    tagline: '"숫자 뒤의 패턴을 읽어냅니다."',
    description: '저장율·공유율·시청 지속율 핵심 KPI 추적. "왜 이 콘텐츠가 터졌는가"를 역설계하여 다음 기획에 직접 반영합니다.',
    strengths: ['KPI 3계층 프레임워크', '콘텐츠 역설계 분석', 'A/B 테스트 판정 설계'],
    color: '#4ecb71',
  },
  {
    id: 'ari', name: 'ARI', role: '비서 / 오케스트레이터',
    category: '기획',
    skills: ['팀 조율', 'QA 검수', '프로젝트 관리'],
    model: 'Gemini Pro',
    avatar: '/avatars/ari.svg',
    emoji: '⚡',
    tagline: '"팀 전체를 하나처럼 움직입니다."',
    description: '콘텐츠 파이프라인 통제부터 발행 전 5-Points QA까지. 선제적 일정 제안과 에러 복구 계약으로 팀 안전망을 구축합니다.',
    strengths: ['5-Points 발행 전 QA', '선제적 일정 제안', 'CCB 프로토콜 인수인계'],
    color: '#38bdf8',
  },
];

const ROLE_FILTERS = ['전체', '마케팅', '디자인', '기획', '데이터분석'];

/* ─── TalentCard ───────────────────────────────────────────────────── */
function TalentCard({ agent, isSelected, onClick }) {
  return (
    <div
      onClick={() => onClick(agent)}
      style={{
        background: isSelected
          ? `rgba(100,135,242,0.12)`
          : 'rgba(255,255,255,0.03)',
        border: `1.5px solid ${isSelected ? agent.color : 'rgba(255,255,255,0.07)'}`,
        borderRadius: '16px',
        padding: '1.5rem 1.25rem',
        cursor: 'pointer',
        transition: 'all 0.22s ease',
        position: 'relative',
        backdropFilter: 'blur(10px)',
        boxShadow: isSelected
          ? `0 0 28px ${agent.color}40`
          : '0 4px 20px rgba(0,0,0,0.2)',
      }}
      onMouseEnter={e => {
        if (!isSelected) {
          e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
          e.currentTarget.style.border = `1.5px solid ${agent.color}`;
          e.currentTarget.style.boxShadow = `0 8px 32px ${agent.color}30`;
        }
      }}
      onMouseLeave={e => {
        if (!isSelected) {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.border = '1.5px solid rgba(255,255,255,0.07)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
        }
      }}
    >
      {/* 역할 배지 */}
      <div style={{ position: 'absolute', top: '0.85rem', right: '0.85rem' }}>
        <span style={{
          fontSize: '0.6rem', fontWeight: 700,
          background: `${agent.color}20`, color: agent.color,
          padding: '2px 8px', borderRadius: '99px',
          border: `1px solid ${agent.color}40`,
          letterSpacing: '0.03em',
        }}>
          {agent.category}
        </span>
      </div>

      {/* 아바타 */}
      <div style={{
        width: '64px', height: '64px', borderRadius: '50%',
        background: `${agent.color}18`,
        border: `2px solid ${agent.color}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '2rem', marginBottom: '0.85rem',
      }}>
        {agent.emoji}
      </div>

      {/* 이름 + 역할 */}
      <p style={{
        fontSize: '1rem', fontWeight: 800,
        color: 'var(--text-primary)', margin: '0 0 0.15rem',
        fontFamily: 'Space Grotesk, sans-serif',
      }}>
        {agent.name}
      </p>
      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 0.9rem' }}>
        {agent.role} · {agent.model}
      </p>

      {/* 스킬 배지 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
        {agent.skills.map(s => (
          <span key={s} style={{
            fontSize: '0.6rem', fontWeight: 600,
            background: 'rgba(255,255,255,0.06)',
            color: 'var(--text-secondary)',
            padding: '2px 7px', borderRadius: '4px',
          }}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── SlideUpPanel (이력서 뷰) ─────────────────────────────────────── */
function SlideUpPanel({ agent, onClose, onHire }) {
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [hired, setHired] = useState(false);

  const handleHire = () => {
    if (!selectedTeam) return;
    onHire(agent, selectedTeam);
    setHired(true);
    setTimeout(onClose, 1200);
  };

  return (
    <div
      style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'var(--bg-document)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px 20px 0 0',
        padding: '2rem',
        animation: 'slideUp 0.3s ease-out',
        zIndex: 10,
        maxHeight: '75%',
        overflowY: 'auto',
      }}
    >
      <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity:0; } to { transform: translateY(0); opacity:1; } }`}</style>

      {/* 핸들바 */}
      <div style={{
        width: '36px', height: '4px',
        background: 'rgba(255,255,255,0.15)',
        borderRadius: '2px', margin: '0 auto 1.5rem',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', marginBottom: '1.5rem' }}>
        {/* 큰 아바타 */}
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: `${agent.color}18`,
          border: `2.5px solid ${agent.color}60`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2.8rem', flexShrink: 0,
        }}>
          {agent.emoji}
        </div>
        <div>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 0.2rem', fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>
            {agent.name}
          </h3>
          <p style={{ fontSize: '0.8rem', color: agent.color, fontWeight: 600, margin: '0 0 0.15rem' }}>
            {agent.role}
          </p>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>
            {agent.model}
          </p>
        </div>
      </div>

      {/* 한줄 태그라인 */}
      <p style={{
        fontSize: '0.85rem', fontStyle: 'italic',
        color: 'var(--text-secondary)',
        borderLeft: `3px solid ${agent.color}`,
        paddingLeft: '0.85rem',
        marginBottom: '1.2rem',
      }}>
        {agent.tagline}
      </p>

      {/* 설명 */}
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '1.25rem' }}>
        {agent.description}
      </p>

      {/* 핵심 강점 */}
      <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>핵심 강점</p>
      <ul style={{ margin: '0 0 1.5rem', paddingLeft: '1rem' }}>
        {agent.strengths.map(s => (
          <li key={s} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{s}</li>
        ))}
      </ul>

      {/* 팀 선택 */}
      <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.65rem' }}>
        어느 팀에 합류시킬까요?
      </p>
      <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.25rem' }}>
        {['A', 'B'].map(team => (
          <button
            key={team}
            onClick={() => setSelectedTeam(team)}
            style={{
              flex: 1, padding: '0.7rem',
              borderRadius: '10px', border: '1.5px solid',
              borderColor: selectedTeam === team ? agent.color : 'rgba(255,255,255,0.1)',
              background: selectedTeam === team ? `${agent.color}18` : 'transparent',
              color: selectedTeam === team ? agent.color : 'var(--text-muted)',
              fontWeight: 700, fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.18s',
              boxShadow: selectedTeam === team ? `0 0 16px ${agent.color}30` : 'none',
            }}
          >
            {team === 'A' ? '🔴 프로젝트 A팀' : '🔵 프로젝트 B팀'}
          </button>
        ))}
      </div>

      {/* 영입 확정 버튼 */}
      <button
        onClick={handleHire}
        disabled={!selectedTeam || hired}
        style={{
          width: '100%', padding: '0.85rem',
          borderRadius: '12px', border: 'none',
          background: hired
            ? '#4ecb71'
            : selectedTeam
              ? `linear-gradient(135deg, ${agent.color}, ${agent.color}cc)`
              : 'rgba(255,255,255,0.06)',
          color: (hired || selectedTeam) ? '#fff' : 'var(--text-muted)',
          fontWeight: 800, fontSize: '0.9rem',
          cursor: selectedTeam && !hired ? 'pointer' : 'default',
          transition: 'all 0.2s',
          letterSpacing: '0.02em',
        }}
      >
        {hired ? '✓ 영입 완료! 🎉' : `✓ ${agent.name} 영입 확정`}
      </button>

      {/* 닫기 */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: '1rem', right: '1rem',
          background: 'transparent', border: 'none',
          color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem',
        }}
      >
        ×
      </button>
    </div>
  );
}

/* ─── Main Modal ───────────────────────────────────────────────────── */
export default function RecruitTalentModal({ onClose }) {
  const { addAgent } = useAgentStore();
  const [activeFilter, setActiveFilter] = useState('전체');
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [hiredName, setHiredName] = useState('');

  const filtered = activeFilter === '전체'
    ? ROSTER_POOL
    : ROSTER_POOL.filter(a => a.category === activeFilter);

  const handleHire = (agent, teamGroup) => {
    addAgent(agent.role, teamGroup);
    setHiredName(`${agent.name}이(가) 프로젝트 ${teamGroup}팀에 합류했습니다 🎉`);
    setTimeout(() => {
      setSelectedAgent(null);
      onClose?.();
    }, 1500);
  };

  return (
    /* 배경 블러 오버레이 */
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(14px)',
        zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      {/* 모달 패널 */}
      <div style={{
        width: '100%', maxWidth: '780px',
        height: '85vh',
        background: 'var(--bg-document)',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}>

        {/* 헤더 */}
        <div style={{
          padding: '1.5rem 1.75rem 1rem',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <h2 style={{
              fontSize: '1.3rem', fontWeight: 800,
              margin: 0, fontFamily: 'Space Grotesk, sans-serif',
              color: 'var(--text-primary)',
            }}>
              크루 영입
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.06)', border: 'none',
                borderRadius: '8px', width: '32px', height: '32px',
                color: 'var(--text-muted)', cursor: 'pointer',
                fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 1.1rem' }}>
            프로젝트 핏에 맞는 AI 크루를 선택하고 팀에 합류시키세요.
          </p>

          {/* 역할 필터 */}
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            {ROLE_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => { setActiveFilter(f); setSelectedAgent(null); }}
                style={{
                  padding: '0.3rem 0.85rem',
                  borderRadius: '99px',
                  border: '1.5px solid',
                  borderColor: activeFilter === f ? 'var(--brand)' : 'rgba(255,255,255,0.1)',
                  background: activeFilter === f ? 'rgba(100,135,242,0.15)' : 'transparent',
                  color: activeFilter === f ? 'var(--brand)' : 'var(--text-muted)',
                  fontSize: '0.72rem', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* 카드 그리드 / 이력서 패널 공간 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.75rem', position: 'relative' }}>

          {/* 영입 완료 토스트 */}
          {hiredName && (
            <div style={{
              position: 'sticky', top: 0, zIndex: 20,
              background: '#4ecb71', color: '#fff',
              padding: '0.6rem 1rem', borderRadius: '8px',
              fontSize: '0.8rem', fontWeight: 700,
              marginBottom: '1rem', textAlign: 'center',
              animation: 'fadeIn 0.2s ease',
            }}>
              {hiredName}
            </div>
          )}

          {/* 재능 그리드 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '0.9rem',
          }}>
            {filtered.map(agent => (
              <TalentCard
                key={agent.id}
                agent={agent}
                isSelected={selectedAgent?.id === agent.id}
                onClick={setSelectedAgent}
              />
            ))}
          </div>

          {/* SlideUp 이력서 패널 */}
          {selectedAgent && (
            <SlideUpPanel
              agent={selectedAgent}
              onClose={() => setSelectedAgent(null)}
              onHire={handleHire}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * PicoCharacter.tsx — 피코 애니메이션 캐릭터 컴포넌트
 *
 * 단일 PNG 기반 CSS 애니메이션으로 말하는 느낌 구현:
 * - 바디 밥 (상하 사인파)
 * - 눈 깜빡임 (90프레임마다)
 * - 입 열림/닫힘 오실레이션 (TTS 싱크)
 * - 팔 흔들기 (미약 rotate)
 * - 드롭섀도우 글로우
 */

import { useCurrentFrame, interpolate, staticFile } from "remotion";

type PicoPlacement = "right" | "left";

interface PicoCharacterProps {
  placement?: PicoPlacement;
  withCircle?: boolean;       // 원형 프레임 여부
  size?: number;              // 캐릭터 크기 (px)
  talking?: boolean;          // TTS 재생 중 여부 (입 애니메이션 강도 조절)
}

export const PicoCharacter = ({
  placement = "right",
  withCircle = false,
  size = 320,
  talking = true,
}: PicoCharacterProps) => {
  const frame = useCurrentFrame();

  // ── 1. 바디 밥: 30프레임 주기 sin파 ────────────────────────
  const bodyBob = Math.sin((frame / 30) * Math.PI) * 5;

  // ── 2. 팔 흔들기: 45프레임 주기 미약 회전 ────────────────────
  const armSwing = Math.sin((frame / 45) * Math.PI) * 2;

  // ── 3. 눈 깜빡임: 90프레임마다 5프레임간 scaleY 0 ─────────────
  const blinkPhase = frame % 90;
  const eyeScaleY = blinkPhase < 5
    ? interpolate(blinkPhase, [0, 2, 5], [1, 0.05, 1], { extrapolateRight: 'clamp' })
    : 1;

  // ── 4. 입 오실레이션: talking이면 6프레임 주기로 열림/닫힘 ─────
  const mouthOpen = talking
    ? Math.abs(Math.sin((frame / 6) * Math.PI))
    : 0;

  // ── 5. 입장 애니메이션: 처음 20프레임 동안 슬라이드업 ────────────
  const enterY = interpolate(frame, [0, 20], [80, 0], { extrapolateRight: 'clamp' });
  const enterOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  // ── 6. 배치 위치 ───────────────────────────────────────────
  const posStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '160px',
    ...(placement === 'right' ? { right: '40px' } : { left: '40px' }),
    zIndex: 50,
    opacity: enterOpacity,
    transform: `translateY(${enterY + bodyBob}px) rotate(${armSwing}deg)`,
    transformOrigin: 'center bottom',
  };

  const picoSrc = staticFile('pico.png');

  if (withCircle) {
    // ── 원형 프레임 모드 ───────────────────────────────────────
    return (
      <div style={posStyle}>
        <div style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'rgba(10, 10, 20, 0.65)',
          border: '4px solid rgba(74, 222, 128, 0.7)',
          boxShadow: '0 0 30px rgba(74, 222, 128, 0.4), inset 0 0 20px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(12px)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          position: 'relative',
        }}>
          <img
            src={picoSrc}
            style={{
              width: size * 0.9,
              height: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.5))',
            }}
          />
          {/* 눈 깜빡임 오버레이 */}
          <EyeBlinkOverlay frame={frame} eyeScaleY={eyeScaleY} size={size} />
          {/* 입 오실레이션 오버레이 */}
          {talking && <MouthOverlay mouthOpen={mouthOpen} size={size} />}
        </div>
      </div>
    );
  }

  // ── 원형 없는 풀 오버레이 모드 (기본) ──────────────────────────
  return (
    <div style={posStyle}>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <img
          src={picoSrc}
          style={{
            width: size,
            height: 'auto',
            filter: `drop-shadow(0 12px 24px rgba(0,0,0,0.6)) drop-shadow(0 0 ${8 + mouthOpen * 6}px rgba(74,222,128,${0.2 + mouthOpen * 0.2}))`,
          }}
        />
        {/* 눈 깜빡임 오버레이 */}
        <EyeBlinkOverlay frame={frame} eyeScaleY={eyeScaleY} size={size} />
        {/* 입 오실레이션 오버레이 */}
        {talking && <MouthOverlay mouthOpen={mouthOpen} size={size} />}
      </div>

      {/* 말풍선 (선택적) */}
      <SpeechBubble frame={frame} placement={placement} />
    </div>
  );
};

// ── 눈 깜빡임 오버레이 ──────────────────────────────────────────
const EyeBlinkOverlay = ({ frame, eyeScaleY, size }: { frame: number; eyeScaleY: number; size: number }) => {
  if (eyeScaleY >= 0.95) return null; // 거의 열려있으면 숨김
  return (
    <div style={{
      position: 'absolute',
      // 피코 눈 위치 (캐릭터 비율 기준 근사값)
      top: '28%',
      left: '18%',
      width: '64%',
      height: '12%',
      background: '#F5C9A0', // 피부색 — 눈을 가림
      borderRadius: '2px',
      transform: `scaleY(${1 - eyeScaleY})`,
      transformOrigin: 'center center',
      opacity: 0.85,
      pointerEvents: 'none',
    }} />
  );
};

// ── 입 오실레이션 오버레이 ──────────────────────────────────────
const MouthOverlay = ({ mouthOpen, size }: { mouthOpen: number; size: number }) => {
  const mouthHeight = mouthOpen * 14; // 최대 14px 열림
  return (
    <div style={{
      position: 'absolute',
      // 피코 입 위치 근사값
      top: '46%',
      left: '34%',
      width: '32%',
      height: `${8 + mouthHeight}px`,
      background: mouthOpen > 0.3 ? '#3B1818' : '#C07060', // 열리면 어둡게
      borderRadius: mouthOpen > 0.3 ? '0 0 12px 12px' : '50%',
      transform: `scaleY(${0.3 + mouthOpen * 0.7})`,
      transformOrigin: 'top center',
      opacity: 0.75,
      pointerEvents: 'none',
      transition: 'border-radius 0.05s',
    }} />
  );
};

// ── 말하는 중 말풍선 (선택적 장식) ──────────────────────────────
const SpeechBubble = ({ frame, placement }: { frame: number; placement: PicoPlacement }) => {
  // 말풍선은 15프레임 주기로 살짝 펄스
  const pulse = 1 + Math.sin((frame / 15) * Math.PI) * 0.03;
  const bubbleOpacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      position: 'absolute',
      top: '-40px',
      ...(placement === 'right' ? { right: '0px' } : { left: '0px' }),
      background: 'rgba(74, 222, 128, 0.15)',
      border: '2px solid rgba(74, 222, 128, 0.5)',
      backdropFilter: 'blur(8px)',
      borderRadius: '20px',
      padding: '8px 16px',
      fontSize: '28px',
      color: '#4ade80',
      fontWeight: 700,
      transform: `scale(${pulse})`,
      opacity: bubbleOpacity,
      whiteSpace: 'nowrap',
      boxShadow: '0 4px 12px rgba(74,222,128,0.2)',
    }}>
      PICO 📊
    </div>
  );
};

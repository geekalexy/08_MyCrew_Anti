/**
 * PicoCharacter.tsx — 피코 애니메이션 캐릭터 컴포넌트 v2
 *
 * 단일 PNG 기반 CSS 애니메이션:
 * 🚶 걷기: sin파 좌우 이동 ±150px
 * 🔄 방향전환: cosine derivation → 이동방향 감지 → scaleX flip
 * 😮 턴 연출: 방향전환 순간 scaleX 스쿼시 → 얼굴 돌리는 느낌
 * 🦿 다리: 빠른 rotate waddle (걷는 흔들림)
 * 👁️ 눈 깜빡임: 90프레임마다
 * 👄 입 오실레이션: TTS 싱크
 */

import { useCurrentFrame, interpolate, staticFile } from "remotion";

type PicoPlacement = "right" | "left";

interface PicoCharacterProps {
  placement?: PicoPlacement;
  withCircle?: boolean;
  size?: number;
  talking?: boolean;
}

// ── 걷기 파라미터 ─────────────────────────────────────────────────
const WALK_PERIOD = 210;    // 프레임당 한 왕복 (7초 @ 30fps)
const WALK_RANGE  = 130;    // 좌우 이동 범위 px (±130)
const TURN_THRESHOLD = 0.18; // 이 미만이면 "턴 중" 판정

export const PicoCharacter = ({
  placement = "right",
  withCircle = false,
  size = 300,
  talking = true,
}: PicoCharacterProps) => {
  const frame = useCurrentFrame();

  // ── 1. 걷기: sin파 좌우 이동 ────────────────────────────────────
  const walkSin  = Math.sin((frame / WALK_PERIOD) * Math.PI * 2);
  const walkX    = walkSin * WALK_RANGE;

  // cos(θ) = sin의 1차 미분 → 양수면 오른쪽으로 이동 중
  const walkCos  = Math.cos((frame / WALK_PERIOD) * Math.PI * 2);
  const movingRight = walkCos > 0;

  // ── 2. 방향전환 감지 + 스쿼시 ────────────────────────────────────
  // cos 절댓값이 TURN_THRESHOLD 미만 = 속도 최대인 방향전환 지점이 아닌
  // sin 절댓값 최대(= 양끝) 에서 방향이 바뀜 → 이때 cos ≈ 0
  // 따라서 cos 절댓값이 TURN_THRESHOLD 미만이면 턴 연출
  const absWalkCos = Math.abs(walkCos);
  const isTurning  = absWalkCos < TURN_THRESHOLD;

  let charScaleX: number;
  if (isTurning) {
    // 턴 중심에서 0이 됐다가 반전 — 스쿼시로 얼굴 돌리는 느낌
    const squeezeRatio = absWalkCos / TURN_THRESHOLD; // 0→1 (0 = 완전 납작)
    const squeezed = Math.max(0.06, squeezeRatio);
    charScaleX = movingRight ? squeezed : -squeezed;
  } else {
    charScaleX = movingRight ? 1 : -1;
  }

  // ── 3. 다리 흔들기 (걷는 워들): 빠른 주기 rotate ──────────────────
  const waddle = Math.sin((frame / 9) * Math.PI) * 3.5; // ±3.5도, 빠른 걷기

  // ── 4. 바디 밥 (상하): 걷기 속도에 맞춰 2배 주기 ──────────────────
  const bodyBob = Math.abs(Math.sin((frame / 9) * Math.PI)) * -6; // 발 디딜 때마다 살짝 아래

  // ── 5. 눈 깜빡임: 90프레임마다 ───────────────────────────────────
  const blinkPhase = frame % 90;
  const eyeScaleY  = blinkPhase < 5
    ? interpolate(blinkPhase, [0, 2, 5], [1, 0.05, 1], { extrapolateRight: 'clamp' })
    : 1;

  // ── 6. 입 오실레이션 ─────────────────────────────────────────────
  const mouthOpen = talking
    ? Math.abs(Math.sin((frame / 6) * Math.PI))
    : 0;

  // ── 7. 입장 페이드인 ─────────────────────────────────────────────
  const enterY       = interpolate(frame, [0, 20], [80, 0], { extrapolateRight: 'clamp' });
  const enterOpacity = interpolate(frame, [0, 15], [0, 1],  { extrapolateRight: 'clamp' });

  // ── 8. 배치 기준점 (placement로 시작 X축 오프셋 결정) ────────────
  // right: 화면 오른쪽에서 중앙 방향으로 왕복
  // left: 화면 왼쪽에서 중앙 방향으로 왕복
  const baseOffset = placement === 'right' ? 60 : -60;

  const wrapperStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '120px',
    // 배치에 따라 기준 위치 고정 후 walkX를 더함
    ...(placement === 'right'
      ? { right: `calc(${baseOffset}px - ${walkX}px)` }   // right일 때 음수 walk = 더 오른쪽으로
      : { left:  `calc(${baseOffset}px + ${walkX}px)` }), // left일 때
    zIndex: 50,
    opacity: enterOpacity,
    transform: `translateY(${enterY + bodyBob}px)`,
    transition: 'right 0s, left 0s',
  };

  const innerStyle: React.CSSProperties = {
    transform: `rotate(${waddle}deg) scaleX(${charScaleX})`,
    transformOrigin: 'center bottom',
    display: 'inline-block',
    // 턴 중 약간 불투명 → 동적 느낌
    filter: `drop-shadow(0 12px 24px rgba(0,0,0,0.6))
             drop-shadow(0 0 ${8 + mouthOpen * 6}px rgba(74,222,128,${0.2 + mouthOpen * 0.2}))
             ${isTurning ? 'blur(0.5px)' : ''}`,
  };

  const picoSrc = staticFile('pico.png');

  if (withCircle) {
    return (
      <div style={wrapperStyle}>
        <div style={{
          width: size, height: size,
          borderRadius: '50%',
          background: 'rgba(10,10,20,0.65)',
          border: '4px solid rgba(74,222,128,0.7)',
          boxShadow: '0 0 30px rgba(74,222,128,0.4)',
          backdropFilter: 'blur(12px)',
          overflow: 'hidden',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          position: 'relative',
        }}>
          <div style={innerStyle}>
            <img src={picoSrc} style={{ width: size * 0.9, height: 'auto' }} />
          </div>
          <EyeBlinkOverlay eyeScaleY={eyeScaleY} size={size} />
          {talking && <MouthOverlay mouthOpen={mouthOpen} size={size} />}
        </div>
      </div>
    );
  }

  return (
    <div style={wrapperStyle}>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <div style={innerStyle}>
          <img src={picoSrc} style={{ width: size, height: 'auto' }} />
        </div>
        <EyeBlinkOverlay eyeScaleY={eyeScaleY} size={size} />
        {talking && <MouthOverlay mouthOpen={mouthOpen} size={size} />}
      </div>
      <SpeechBubble frame={frame} placement={placement} charScaleX={charScaleX} />
    </div>
  );
};

// ── 눈 깜빡임 오버레이 ────────────────────────────────────────────
const EyeBlinkOverlay = ({ eyeScaleY, size }: { eyeScaleY: number; size: number }) => {
  if (eyeScaleY >= 0.95) return null;
  return (
    <div style={{
      position: 'absolute',
      top: '28%', left: '18%', width: '64%', height: '12%',
      background: '#F5C9A0',
      borderRadius: '2px',
      transform: `scaleY(${1 - eyeScaleY})`,
      transformOrigin: 'center center',
      opacity: 0.85,
      pointerEvents: 'none',
    }} />
  );
};

// ── 입 오실레이션 오버레이 ────────────────────────────────────────
const MouthOverlay = ({ mouthOpen, size }: { mouthOpen: number; size: number }) => {
  const mouthHeight = mouthOpen * 14;
  return (
    <div style={{
      position: 'absolute',
      top: '46%', left: '34%', width: '32%',
      height: `${8 + mouthHeight}px`,
      background: mouthOpen > 0.3 ? '#3B1818' : '#C07060',
      borderRadius: mouthOpen > 0.3 ? '0 0 12px 12px' : '50%',
      transform: `scaleY(${0.3 + mouthOpen * 0.7})`,
      transformOrigin: 'top center',
      opacity: 0.75,
      pointerEvents: 'none',
    }} />
  );
};

// ── 말풍선: 이동 방향에 따라 좌우 반전 ───────────────────────────
const SpeechBubble = ({ frame, placement, charScaleX }:
  { frame: number; placement: PicoPlacement; charScaleX: number }
) => {
  const pulse   = 1 + Math.sin((frame / 15) * Math.PI) * 0.03;
  const opacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });

  // 피코 얼굴 방향이 바뀌면 말풍선도 반대쪽으로
  const bubbleRight = charScaleX > 0; // 오른쪽 보면 말풍선 오른쪽 위

  return (
    <div style={{
      position: 'absolute',
      top: '-44px',
      ...(bubbleRight ? { right: '0px' } : { left: '0px' }),
      background: 'rgba(74,222,128,0.15)',
      border: '2px solid rgba(74,222,128,0.5)',
      backdropFilter: 'blur(8px)',
      borderRadius: '16px',
      padding: '6px 14px',
      fontSize: '26px',
      color: '#4ade80',
      fontWeight: 700,
      transform: `scale(${pulse})`,
      opacity,
      whiteSpace: 'nowrap',
      boxShadow: '0 4px 12px rgba(74,222,128,0.2)',
    }}>
      PICO 📊
    </div>
  );
};

import { AbsoluteFill, useVideoConfig, useCurrentFrame, Sequence, spring, interpolate } from "remotion";

type ThemeProps = {
  primaryColor?: string;
  secondaryColor?: string;
  bgGradient?: string[];
};

type SceneProps = {
  type?: string;
  durationFrames: number;
  layoutType?: string;
  assetType?: string;
  assetContent?: string;
  textLines?: string[];
  animationType?: string;
  highlightColor?: string;
  interactionElement?: string;
};

export const MyComposition = ({ 
  theme = { primaryColor: "#1E90FF", secondaryColor: "#FAFAFA", bgGradient: ["#0F172A", "#1E1B4B"] },
  scenes = [],
  durationInSeconds,
  fps: fpsProp
}: { 
  theme?: ThemeProps; 
  scenes?: SceneProps[]; 
  durationInSeconds?: number;
  fps?: number;
}) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  let currentStart = 0;

  return (
    <AbsoluteFill style={{ 
      backgroundColor: "#3B7BF5",
      fontFamily: "'SUIT', sans-serif",
      overflow: "hidden"
    }}>
      {/* 1. 소시안 블루 그라데이션 배경 */}
      <AbsoluteFill style={{
        background: 'linear-gradient(135deg, #3B7BF5 0%, #1D4ED8 100%)',
      }} />

      {scenes?.map((scene, index) => {
        const start = currentStart;
        const duration = scene.durationFrames || 90;
        currentStart += duration;
        
        return (
          <Sequence key={index} from={start} durationInFrames={duration}>
            <SceneContent scene={scene} fps={fps} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const SceneContent = ({ scene, fps }: { scene: SceneProps; fps: number; }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const scaleIn = interpolate(frame, [0, 15], [0.85, 1], { extrapolateRight: "clamp" });
  const yOffset = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const texts = scene.textLines || [];
  
  // Gemini가 지시한 에셋 (명시적 에셋이 없으면 기본 아이콘 렌더링)
  const getFallbackIcon = (type: string | undefined) => {
    switch(type) {
      case 'hook': return '📱';
      case 'solution': return '⚡';
      case 'value': return '💸';
      case 'cta': return '🎁';
      default: return '✨';
    }
  };
  const asset = scene.assetContent || getFallbackIcon(scene.type);

  // Gemini가 결정한 layoutType에 따라 화면 레이아웃을 동적 분기
  const renderLayout = () => {
    if (scene.layoutType === 'chat-bubble') {
      // 1. 인스타그램 DM 챗버블 (Solution, 1:1 대화형 씬에 적합)
      const slideUp = `translateY(${interpolate(yOffset, [0, 1], [100, 0])}px)`;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '90%', maxWidth: '900px', transform: slideUp, opacity }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '20px' }}>
            <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#FFF', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '50px', marginRight: '30px', boxShadow: '0 10px 20px rgba(0,0,0,0.2)' }}>
              {asset}
            </div>
            <div style={{ background: '#FFFFFF', borderRadius: '40px 40px 40px 10px', padding: '50px 60px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
              {texts.map((text, i) => (
                <div key={i} style={{ fontSize: '65px', fontWeight: 800, color: '#111827', lineHeight: 1.4, wordBreak: 'keep-all' }}>{text}</div>
              ))}
            </div>
          </div>
          <div style={{ alignSelf: 'flex-end', background: '#3B7BF5', border: '5px solid #FFFFFF', borderRadius: '40px 40px 10px 40px', padding: '40px 50px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', marginTop: '30px' }}>
             <div style={{ fontSize: '55px', fontWeight: 800, color: '#FFF' }}>확인하기🚀</div>
          </div>
        </div>
      );
    } 
    else if (scene.layoutType === 'notification') {
      // 2. iOS 알림 팝업 (Hook, 주의 끌기 씬에 적합)
      const dropDown = `translateY(${interpolate(yOffset, [0, 1], [-150, 0])}px)`;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', transform: dropDown, opacity, position: 'absolute', top: '15%' }}>
          <div style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', borderRadius: '40px', padding: '50px 60px', width: '90%', maxWidth: '950px', display: 'flex', alignItems: 'center', boxShadow: '0 30px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: '90px', marginRight: '50px' }}>{asset}</div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: '35px', color: '#6B7280', fontWeight: 600, marginBottom: '15px' }}>SOCIAN ALARM 🔔</div>
              {texts.map((text, i) => (
                <div key={i} style={{ fontSize: i===texts.length-1 ? '60px' : '50px', fontWeight: i===texts.length-1 ? 900 : 700, color: i===texts.length-1 ? '#3B7BF5' : '#111827', wordBreak: 'keep-all' }}>{text}</div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    else {
      // 3. 기본 Centered 폴백 (타이포그래피 위주 모션)
      const scaleTransform = `scale(${scaleIn}) translateY(${interpolate(yOffset, [0, 1], [50, 0])}px)`;
      const floatY = interpolate(Math.sin(frame / 15), [-1, 1], [-20, 20]);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', transform: `${scaleTransform}`, opacity }}>
          <div style={{ fontSize: '150px', marginBottom: '50px', transform: `translateY(${floatY}px)`, textShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>{asset}</div>
          {texts.map((text, i) => (
            <div key={i} style={{ fontSize: i === 0 ? "80px" : "110px", fontWeight: 900, lineHeight: 1.35, marginBottom: "20px", color: i === texts.length - 1 ? '#FFFFFF' : '#D1D5DB', textShadow: "0 10px 30px rgba(0,0,0,0.4)", wordBreak: "keep-all" }}>
              {text}
            </div>
          ))}
          {scene.type === 'cta' && (
            <div style={{ marginTop: '70px', background: '#FFF', color: '#3B7BF5', padding: '35px 90px', borderRadius: '35px', fontSize: '65px', fontWeight: 900, boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
              알아보기 👉
            </div>
          )}
        </div>
      );
    }
  };

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", display: "flex", flexDirection: "column", padding: "40px", textAlign: "center" }}>
      {/* 백그라운드 워터마크 아이콘 */}
      <div style={{ position: 'absolute', fontSize: '500px', opacity: 0.1, filter: 'blur(12px)', zIndex: 0 }}>
        {asset}
      </div>
      <div style={{ zIndex: 10, width: '100%', display: 'flex', justifyContent: 'center' }}>
        {renderLayout()}
      </div>
    </AbsoluteFill>
  );
};

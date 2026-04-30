import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Montserrat";

const { fontFamily } = loadFont();

const DARK_BG = "#1E2A2A";
const DARK_BG2 = "#1E2A2A";

// ─── RGB Glitch Overlay (6 frames) — true chromatic aberration via CSS filters ─────
const GlitchOverlay: React.FC<{ children?: React.ReactNode }> = () => {
  // This is a dummy — the real glitch is applied as a wrapper
  return null;
};

// Glitch frame positions and their offsets
const GLITCH_FRAMES = [170, 440, 650, 825, 990, 1200, 1460, 1675, 1855, 2065];
const GLITCH_DURATION = 6;
const GLITCH_OFFSETS = [15, 30, 40, 32, 20, 10];

// Wrapper — RGB split: 3 copies of content with channel tinting
const GlitchWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();

  let glitchFrame = -1;
  for (const gf of GLITCH_FRAMES) {
    if (frame >= gf && frame < gf + GLITCH_DURATION) {
      glitchFrame = frame - gf;
      break;
    }
  }

  if (glitchFrame < 0) {
    return <>{children}</>;
  }

  const offset = GLITCH_OFFSETS[glitchFrame];
  const vertOffset = offset * 0.3;

  return (
    <AbsoluteFill>
      {/* Red channel — shifted left+down */}
      <AbsoluteFill style={{
        transform: `translate(${-offset}px, ${vertOffset}px)`,
        opacity: 0.7,
      }}>
        {children}
        <AbsoluteFill style={{ backgroundColor: "rgba(255,30,30,0.7)", mixBlendMode: "screen" }} />
      </AbsoluteFill>
      {/* Green channel — original position */}
      <AbsoluteFill style={{ opacity: 0.9 }}>
        {children}
      </AbsoluteFill>
      {/* Blue channel — shifted right+up */}
      <AbsoluteFill style={{
        transform: `translate(${offset}px, ${-vertOffset}px)`,
        opacity: 0.7,
      }}>
        {children}
        <AbsoluteFill style={{ backgroundColor: "rgba(0,80,255,0.6)", mixBlendMode: "color" }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Real images from NORA platform
const NORA_IMAGES = [
  staticFile("images/g1.png"),  // #1 CSJ
  staticFile("images/g2.png"),  // #7 RTK
  staticFile("images/g3.png"),  // #10 JAUS
  staticFile("images/g4.png"),  // #776 Cemtra
  staticFile("images/g5.png"),  // #778 RTK
  staticFile("images/g6.png"),  // #796 Altas Cumbres
  staticFile("images/g7.png"),  // #2 CSJ
  staticFile("images/g8.png"),  // #8 RTK
  staticFile("images/g9.png"),  // #11 JAUS
  staticFile("images/g10.png"), // #792 Altas Cumbres
  staticFile("images/g11.png"), // #741 Cemtra
  staticFile("images/g12.png"), // #3 CSJ
];
// Creatividades reales generadas (locales en public/images/)
const NORA_CREATIVAS = [
  staticFile("images/c1.png"), // #796 Altas Cumbres
  staticFile("images/c2.png"), // #778 RTK
  staticFile("images/c3.png"), // #776 Cemtra
  staticFile("images/c4.png"), // #792 Altas Cumbres
  staticFile("images/c5.png"), // #741 Cemtra
];
const TEAL = "#5ceaaf";
const PURPLE = "#7b8bf0";

const pseudoRandom = (seed: number) => {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ─── Reusable: App Demo Placeholder with cursor + click at frame 40 ─────
const AppDemoPlaceholder: React.FC<{
  title: string;
  subtitle?: string;
  accentColor?: string;
}> = ({ title, subtitle, accentColor = TEAL }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const s = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const scale = interpolate(s, [0, 1], [0.92, 1]);
  const opacity = interpolate(s, [0, 1], [0, 1]);
  const drift = interpolate(frame, [0, 80], [1, 1.04], { extrapolateRight: "clamp" });

  const cursorX = 800 + Math.sin(frame * 0.06) * 40 + Math.cos(frame * 0.09) * 20;
  const cursorY = 450 + Math.cos(frame * 0.05) * 30 + Math.sin(frame * 0.07) * 15;
  const cursorOpacity = interpolate(frame, [8, 15], [0, 0.9], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Click effect at frame 40: scale 1→0.8→1 over 3 frames
  const clickScale = frame >= 40 && frame <= 42
    ? interpolate(frame, [40, 41, 42], [1, 0.8, 1])
    : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0e0e10" }}>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) scale(${scale * drift})`,
          width: 1400,
          height: 820,
          borderRadius: 16,
          backgroundColor: "#fafafa",
          overflow: "hidden",
          opacity,
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          display: "flex",
        }}
      >
        <div style={{ width: 200, backgroundColor: "#f5f5f5", borderRight: "1px solid #e0e0e0", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: accentColor, marginBottom: 12 }} />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} style={{ height: 14, borderRadius: 4, backgroundColor: i === 2 ? accentColor + "40" : "#e0e0e0", width: i === 2 ? "100%" : `${60 + pseudoRandom(i * 3) * 30}%` }} />
          ))}
        </div>
        <div style={{ flex: 1, padding: 32, position: "relative" }}>
          <div style={{ fontFamily, fontSize: 22, fontWeight: 700, color: "#333", marginBottom: 20 }}>{title}</div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ height: i === 0 ? 60 : 40, borderRadius: 8, backgroundColor: i === 0 ? accentColor + "15" : "#f0f0f0", border: i === 0 ? `1px solid ${accentColor}40` : "1px solid #e8e8e8", marginBottom: 12, width: `${70 + pseudoRandom(i * 7 + 1) * 30}%` }} />
          ))}
          {subtitle && (
            <div style={{ position: "absolute", bottom: 28, right: 32, fontFamily, fontSize: 14, color: "#aaa", fontStyle: "italic" }}>{subtitle}</div>
          )}
        </div>
      </div>
      <svg width="24" height="28" viewBox="0 0 24 28" style={{ position: "absolute", left: cursorX, top: cursorY, opacity: cursorOpacity, filter: "drop-shadow(1px 2px 2px rgba(0,0,0,0.4))", zIndex: 10, transform: `scale(${clickScale})` }}>
        <path d="M5 2l14 10-6.5 1.5L11 20z" fill="white" stroke="#333" strokeWidth="1" />
      </svg>
    </AbsoluteFill>
  );
};

// S01 — Word reveal (gray→white, stagger=5, fadeDuration=4)
const S01_WordReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const words = ["Vivamus", "dolor", "cursus", "et", "amet"];
  const delay = 0;
  const stagger = 4;
  const fadeDuration = 4;
  const totalDuration = 55;
  const shrinkStart = totalDuration - 10;

  // Shrink entire phrase in last 10 frames: 1.0 → 0.25
  const scale = interpolate(frame, [shrinkStart, totalDuration - 1], [1, 0.25], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG, justifyContent: "center", alignItems: "center" }}>
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "0 24px",
        justifyContent: "center",
        transform: `scale(${scale})`,
        transformOrigin: "center center",
      }}>
        {words.map((word, i) => {
          const wordStart = delay + i * stagger;
          const progress = interpolate(frame, [wordStart, wordStart + fadeDuration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const opacity = progress;
          const offsetX = interpolate(progress, [0, 1], [100, 0]); // starts 100px right, slides to final pos
          return (
            <span key={i} style={{
              fontFamily, fontSize: 96, fontWeight: 800, color: "white",
              opacity, lineHeight: 1.1,
              transform: `translateX(${offsetX}px)`,
            }}>{word}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// S02 — "INSANELY HARD" letter-by-letter spring with 5-stop gradient
// FIX #1: letterStagger=2, preOffset=6
// FIX #2: Last 8 frames scale DOWN 1→0.37 (shrink to band), no exitScale zoom-up
const S02_ImpactZoom: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const letters = "CONSEQUAT SED".split("");
  const letterStagger = 2;
  const preOffset = 6;

  // FIX #2: Scale DOWN in last 8 frames (shrink to horizontal band)
  // 20 frames de pausa después de armarse, luego shrink
  const shrinkStart = 47; // 55 - 8
  const containerScale = interpolate(frame, [shrinkStart, 55], [1, 0.37], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const whiteFlash = interpolate(frame, [0, 3], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "white" }}>
      {/* 5-stop gradient background — scaleY only (stays full width) */}
      <AbsoluteFill style={{ background: "linear-gradient(to right, #6bcf9a, #7bb8e0 30%, #8b9cf0 60%, #9a8bea 80%, #8ea0f0)", transform: `scaleY(${containerScale})` }} />
      {/* Text — uniform scale (no deformation) */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ display: "flex", whiteSpace: "nowrap", transform: `scale(${containerScale})` }}>
          {letters.map((letter, i) => {
            const delay = i * letterStagger;
            const s = spring({ frame: Math.max(0, frame + preOffset - delay), fps, config: { damping: 14, stiffness: 200, mass: 0.5 } });
            const y = interpolate(s, [0, 1], [-300, 0], { extrapolateRight: "clamp" });
            const opacity = interpolate(s, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });
            return (
              <span key={i} style={{ fontFamily, fontSize: 100, fontWeight: 600, color: "white", textTransform: "uppercase", display: "inline-block", transform: `translateY(${y}px)`, opacity, letterSpacing: letter === " " ? 30 : "0.04em", minWidth: letter === " " ? 30 : undefined }}>
                {letter === " " ? "\u00A0" : letter}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
      {/* White flash at start */}
      <AbsoluteFill style={{ backgroundColor: "white", opacity: whiteFlash }} />
    </AbsoluteFill>
  );
};

// S03 — Split text (WHITE background, gradient band center)
const S03_SplitText: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const leftSpring = spring({ frame, fps, config: { damping: 14, stiffness: 150, mass: 0.6 } });
  const rightSpring = spring({ frame: Math.max(0, frame - 3), fps, config: { damping: 14, stiffness: 150, mass: 0.6 } });
  const videoSpring = spring({ frame: Math.max(0, frame - 2), fps, config: { damping: 12, stiffness: 150 } });

  const leftX = interpolate(leftSpring, [0, 1], [-300, 0]);
  const rightX = interpolate(rightSpring, [0, 1], [300, 0]);

  // Phase 2 (frame 25-35): gradient band scaleY 100% → 0%
  const bandScaleY = interpolate(frame, [25, 35], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Phase 3 (frame 35-45): bg same color as text (#111) enters from top — text "disappears"
  const darkBgY = interpolate(frame, [35, 45], [-100, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const darkBgOpacity = interpolate(frame, [35, 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Phase 3b (frame 35-45): placeholder grows to 130% as dark bg passes over
  const placeholderScale = interpolate(frame, [35, 45], [1, 1.3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Phase 4 (frame 65-90): placeholder slides out left, 25 frames, easing in (slow→fast)
  const slideProgress = interpolate(frame, [65, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const eased = slideProgress * slideProgress * slideProgress; // cubic ease-in
  const placeholderX = eased * -1200;

  // Text stays #111 always — dark bg is same color, so text "vanishes"
  const textColor = "#111";

  return (
    <AbsoluteFill style={{ backgroundColor: "white" }}>
      {/* Gradient band — horizontal stripe, scaleY shrinks in phase 2 */}
      <div style={{ position: "absolute", top: "31.5%", left: 0, right: 0, height: "37%", background: "linear-gradient(to right, #6bcf9a, #7bb8e0 30%, #8b9cf0 60%, #9a8bea 80%, #8ea0f0)", opacity: 0.3, transform: `scaleY(${bandScaleY})` }} />
      {/* Dark background entering from top */}
      <AbsoluteFill style={{ backgroundColor: "#111", transform: `translateY(${darkBgY}%)`, opacity: darkBgOpacity }} />
      <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "100%", zIndex: 2 }}>
        <div style={{ transform: `translateY(${interpolate(leftSpring, [0, 1], [-200, 0])}px)`, fontFamily, fontSize: 56, fontWeight: 800, color: textColor, opacity: leftSpring, textAlign: "center", whiteSpace: "nowrap", transition: "color 0.1s" }}>sed ut pretium</div>
        <div style={{ transform: `scale(${videoSpring * placeholderScale}) translateX(${eased * -1200}px)`, width: 480, height: 820, borderRadius: 16, overflow: "hidden" }}><Img src={NORA_CREATIVAS[0]} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
        <div style={{ transform: `translateY(${interpolate(rightSpring, [0, 1], [200, 0])}px)`, fontFamily, fontSize: 56, fontWeight: 800, color: textColor, opacity: rightSpring, whiteSpace: "nowrap", textAlign: "center", transition: "color 0.1s" }}>lacus vitae</div>
      </div>
    </AbsoluteFill>
  );
};

// S04 — Video mockup (490×860, no border decoration)
const S04_VideoMockup: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12, stiffness: 80, mass: 0.8 } });
  const scale = interpolate(s, [0, 1], [0.15, 0.85]);
  const opacity = interpolate(s, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });
  const drift = interpolate(frame, [20, 60], [1, 1.08], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(-50%, -50%) scale(${scale * drift})`, width: 380, height: 680, borderRadius: 20, backgroundColor: "#2a2d32", opacity, overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 70, height: 70, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ width: 0, height: 0, borderLeft: "22px solid white", borderTop: "14px solid transparent", borderBottom: "14px solid transparent", marginLeft: 6 }} />
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: "linear-gradient(transparent, rgba(0,0,0,0.6))", padding: "0 16px", display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: 14 }}>
          <div style={{ height: 10, width: "60%", borderRadius: 4, backgroundColor: "rgba(255,255,255,0.4)", marginBottom: 6 }} />
          <div style={{ height: 8, width: "40%", borderRadius: 4, backgroundColor: "rgba(255,255,255,0.2)" }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// S05 — "Wait!" with particles — FIX #3: letter springs verified
const S05_WaitParticles: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const PARTICLE_COUNT = 28;
  const textDelay = 10;
  const letters = "Quis".split("");
  const letterStagger = 3;
  const bangDelay = textDelay + letters.length * letterStagger + 5;

  const bangSpring = spring({ frame: Math.max(0, frame - bangDelay), fps, config: { damping: 12, stiffness: 180, mass: 0.5 } });
  const bangY = interpolate(bangSpring, [0, 1], [-200, 0]);

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG2, overflow: "hidden" }}>
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
        const px = pseudoRandom(i * 3 + 1) * 100;
        const py = pseudoRandom(i * 3 + 2) * 100;
        const size = (6 + pseudoRandom(i * 3 + 3) * 20) * 2;
        const speed = 0.3 + pseudoRandom(i * 7) * 0.7;
        const floatY = Math.sin(frame * speed * 0.08 + i) * 40;
        const floatX = Math.cos(frame * speed * 0.06 + i * 2) * 30;
        const isBig = size > 16;
        const particleColor = isBig ? "#7ac8a0" : "#4efa90";
        const particleOpacity = 0.3 + pseudoRandom(i * 5) * 0.6;
        // Particles enter from behind camera: start at scale 0 (far away) and grow to full size
        const enterDelay = pseudoRandom(i * 11) * 15; // stagger 0-15 frames
        const enterProgress = interpolate(frame, [enterDelay, enterDelay + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const particleScale = interpolate(enterProgress, [0, 1], [10, 1]);
        return (
          <div key={i} style={{ position: "absolute", left: `${px}%`, top: `${py}%`, width: size, height: size, borderRadius: "50%", backgroundColor: particleColor, opacity: particleOpacity * enterProgress, transform: `translate(${floatX}px, ${floatY}px) scale(${particleScale})` }} />
        );
      })}
      {/* Text zoom out: after 20 frames idle, scale 1→10 in 15 frames */}
      {(() => {
        const zoomStart = 70; // ~30 armando + 40 quieta
        const textZoom = interpolate(frame, [zoomStart, zoomStart + 15], [1, 45], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const textZoomOpacity = 1; // no fade out — white fills screen
        return (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(-50%, -50%) scale(${textZoom})`, opacity: textZoomOpacity, display: "flex", alignItems: "baseline" }}>
            {letters.map((letter, i) => {
              const delay = textDelay + i * letterStagger;
              const s = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 12, stiffness: 180, mass: 0.5 } });
              const y = interpolate(s, [0, 1], [-200, 0]);
              return (
                <span key={i} style={{ fontFamily, fontSize: 200, fontWeight: 700, color: "white", display: "inline-block", transform: `translateY(${y}px)`, opacity: interpolate(s, [0, 0.2], [0, 1], { extrapolateRight: "clamp" }) }}>{letter}</span>
              );
            })}
            <span style={{ fontFamily, fontSize: 200, fontWeight: 700, color: "white", display: "inline-block", transform: `translateY(${bangY}px)`, opacity: interpolate(bangSpring, [0, 0.2], [0, 1], { extrapolateRight: "clamp" }), marginLeft: 12 }}>!</span>
          </div>
        );
      })()}
    </AbsoluteFill>
  );
};

// FIX #4: Venetian Blind Transition (5 frames)
const VenetianBlindTransition: React.FC = () => {
  const frame = useCurrentFrame();
  const BAR_COUNT = 10;
  const barWidth = 1920 / BAR_COUNT;
  // Wipe progress: 0→1 over 5 frames, left to right
  const wipeProgress = interpolate(frame, [0, 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG2 }}>
      {/* Underneath: hint of next scene */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", fontFamily, fontSize: 60, fontWeight: 600, background: `linear-gradient(to right, #5ceaaf, #4dd8b0, #7bb8e0)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", whiteSpace: "nowrap" }}>
        Vivamus a
      </div>
      {/* Venetian blind bars sliding left to right */}
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        const barDelay = i / BAR_COUNT;
        const barProgress = interpolate(wipeProgress, [barDelay, barDelay + 0.4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const isEven = i % 2 === 0;
        const barColor = isEven ? DARK_BG2 : "white";
        return (
          <div key={i} style={{
            position: "absolute",
            left: i * barWidth,
            top: 0,
            width: barWidth + 1,
            height: "100%",
            backgroundColor: barColor,
            opacity: 1 - barProgress,
          }} />
        );
      })}
    </AbsoluteFill>
  );
};

// S06 — "There's a" + "secret" → "sauce" — FIX #5: secret smooth scale 1→1.1
const S06_GradientWord: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const gradientStyle: React.CSSProperties = {
    background: `linear-gradient(to right, #5ceaaf, #4dd8b0, #7bb8e0)`,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  };

  const theresIn = spring({ frame, fps, config: { damping: 15, stiffness: 120 } });
  const theresFadeOut = interpolate(frame, [20, 28], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const secretIn = spring({ frame: Math.max(0, frame - 30), fps, config: { damping: 15, stiffness: 120 } });
  const secretScale = interpolate(frame, [30, 58], [1.0, 1.1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const secretFadeOut = interpolate(frame, [58, 62], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const isSauce = frame >= 65;
  const sauceIn = spring({ frame: Math.max(0, frame - 65), fps, config: { damping: 15, stiffness: 120 } });

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG2 }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(-50%, -50%) scale(${interpolate(theresIn, [0, 1], [0.8, 1])})`, fontFamily, fontSize: 140, fontWeight: 700, opacity: theresIn * theresFadeOut, whiteSpace: "nowrap", ...gradientStyle }}>
        Vivamus a
      </div>
      {!isSauce && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(-50%, -50%) scale(${interpolate(secretIn, [0, 1], [0.8, 1])})`, fontFamily, fontSize: 140, fontWeight: 700, opacity: secretIn * secretFadeOut, ...gradientStyle }}>cursus</div>
      )}
      {isSauce && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(-50%, -50%) scale(${interpolate(sauceIn, [0, 1], [0.8, 1])})`, fontFamily, fontSize: 140, fontWeight: 700, opacity: sauceIn, ...gradientStyle }}>porta</div>
      )}
    </AbsoluteFill>
  );
};

// S07 — "Introducing" — FIX #6: Two-phase 6→3 rows with purple sweep
const S07_IntroducingStack: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const text = "Pellentesque";

  // Phase 1 (0-8): Curtain wipe top to bottom
  const curtainProgress = interpolate(frame, [0, 8], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Phase 2 (5-30): 6 rows with purple + green bands, text visible
  const rowCount = 5;
  const heroRow = 2; // center row (0,1 above — 3,4 below)

  // Purple band sweep (phase 2): top → 60% down, then slides UP off screen
  const sweepY = frame < 30
    ? interpolate(frame, [5, 25], [-10, 60], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : interpolate(frame, [30, 40], [60, -50], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const purpleOpacity = 0.5;
  // Green band (offset from purple), then slides DOWN off screen
  const greenSweepY = frame < 30
    ? interpolate(frame, [8, 28], [-10, 50], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : interpolate(frame, [30, 40], [50, 120], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const greenOpacity = 0.35;

  // No zoom before blink — stays at scale 1
  const condenseScale = 1;

  // Phase 4 (45-55): neon flicker — rapid on/off like fluorescent tubes
  const flickerPattern1 = [0, 1, 0, 0, 1, 0, 1, 1, 0, 1]; // 10 frames of flicker
  const flicker1 = frame >= 45 && frame < 55
    ? flickerPattern1[frame - 45]
    : frame >= 55 ? 1 : 1;

  // Phase 5 (55-70): hold 15 frames steady
  // Phase 6 (70-78): second neon flicker before zoom
  const flickerPattern2 = [1, 0, 1, 0, 0, 1, 0, 1]; // 8 frames of flicker
  const flicker2 = frame >= 70 && frame < 78
    ? flickerPattern2[frame - 70]
    : 1;

  // Phase 7 (78-92): zoom 4500%
  const finalZoom = frame >= 78
    ? interpolate(frame, [78, 92], [1, 45], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;

  const textOpacity = flicker1 * flicker2;

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG, overflow: "hidden" }}>
      {/* Curtain wipe top to bottom */}
      {frame < 9 && (
        <div style={{
          position: "absolute", left: 0, right: 0, top: 0, height: `${100 - curtainProgress}%`,
          backgroundColor: "white", zIndex: 5,
        }} />
      )}
      {/* Purple horizontal band */}
      <div style={{ position: "absolute", left: 0, right: 0, top: `${sweepY}%`, height: "35%", backgroundColor: PURPLE, opacity: purpleOpacity, zIndex: 1 }} />
      {/* Green horizontal band */}
      <div style={{ position: "absolute", left: 0, right: 0, top: `${greenSweepY}%`, height: "30%", backgroundColor: TEAL, opacity: greenOpacity, zIndex: 1 }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(-50%, -50%) scale(${finalZoom})`, display: "flex", flexDirection: "column", alignItems: "center", zIndex: 2, opacity: textOpacity }}>
        {Array.from({ length: rowCount }).map((_, i) => {
          const isFilled = i === heroRow;
          const staggerDelay = Math.abs(i - heroRow) * 3 + 5;
          const s = spring({ frame: Math.max(0, frame - staggerDelay), fps, config: { damping: 15, stiffness: 120 } });
          return (
            <div key={i} style={{
              fontFamily,
              fontSize: 140,
              fontWeight: 800,
              lineHeight: 0.95,
              color: isFilled ? "white" : "transparent",
              WebkitTextStroke: isFilled ? "none" : "3px rgba(255,255,255,0.35)",
              fontStyle: isFilled ? "italic" : "normal",
              opacity: interpolate(s, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(s, [0, 1], [30, 0])}px)`,
            }}>{text}</div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// S08 — Clapperboard (300px wide, 45f)
const S08_Clapperboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 10, stiffness: 120, mass: 0.6 } });
  const scale = interpolate(s, [0, 1], [0.1, 1]);
  const clapAngle = interpolate(frame, [15, 25], [0, -30], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const splashScale = interpolate(frame, [25, 38], [0, 12], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const splashOpacity = interpolate(frame, [25, 32, 38], [0, 0.6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", width: 100, height: 100, borderRadius: "50%", background: `radial-gradient(circle, ${TEAL}, ${PURPLE})`, transform: `translate(-50%, -50%) scale(${splashScale})`, opacity: splashOpacity }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(-50%, -50%) scale(${scale})` }}>
        <div style={{ width: 300, height: 58, background: `repeating-linear-gradient(90deg, #222 0px, #222 30px, white 30px, white 60px)`, borderRadius: "8px 8px 0 0", transformOrigin: "left bottom", transform: `rotate(${clapAngle}deg)` }} />
        <div style={{ width: 300, height: 210, backgroundColor: "#222", borderRadius: "0 0 8px 8px", padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: 14, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.2)", width: `${50 + pseudoRandom(i * 5) * 50}%` }} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// S09 — Logo splash — FIX #7: Larger swirl shapes, rotation, white splashes
const S09_LogoSplash: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const swirlScale = interpolate(frame, [0, 20], [0, 8], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const swirlOpacity = interpolate(frame, [0, 10, 20], [0, 0.8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const swirlRotation = frame * 3; // FIX #7: rotate swirl
  const logoSpring = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 14, stiffness: 120 } });
  const logoScale = interpolate(logoSpring, [0, 1], [0.5, 1]);

  // Green circle forms at center after swirl
  const greenCircleScale = interpolate(frame, [12, 18], [0, 1.2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const greenCircleOpacity = interpolate(frame, [12, 15, 20, 25], [0, 0.8, 0.6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const swirlShapes = [
    { color: TEAL, dist: 60, size: 120, angle: 0 },
    { color: PURPLE, dist: 90, size: 100, angle: 90 },
    { color: "#ff6b6b", dist: 50, size: 80, angle: 180 },
    { color: "#ffd93d", dist: 110, size: 90, angle: 270 },
    { color: "white", dist: 70, size: 60, angle: 45 },
    { color: "white", dist: 100, size: 50, angle: 135 },
    { color: "white", dist: 40, size: 70, angle: 225 },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG2, overflow: "hidden" }}>
      {/* Swirl shapes — larger, organic, rotating */}
      {swirlShapes.map((shape, i) => {
        const angle = ((swirlRotation + shape.angle) * Math.PI) / 180;
        const x = Math.cos(angle) * shape.dist;
        const y = Math.sin(angle) * shape.dist;
        const isWhite = shape.color === "white";
        return (
          <div key={i} style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: shape.size,
            height: isWhite ? shape.size * 0.6 : shape.size,
            borderRadius: isWhite ? "40% 60% 50% 40%" : "50%",
            backgroundColor: shape.color,
            transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${swirlScale * (1 - i * 0.08)}) rotate(${swirlRotation + i * 30}deg)`,
            opacity: swirlOpacity * (1 - i * 0.1),
          }} />
        );
      })}
      {/* Green circle forming at center */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        width: 140, height: 140, borderRadius: "50%",
        backgroundColor: TEAL,
        transform: `translate(-50%, -50%) scale(${greenCircleScale})`,
        opacity: greenCircleOpacity,
      }} />
      {/* Logo */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(-50%, -50%) scale(${logoScale})`, display: "flex", alignItems: "center", gap: 20, opacity: logoSpring }}>
        <div style={{ width: 160, height: 160, borderRadius: 32, backgroundColor: TEAL, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <span style={{ fontFamily, fontSize: 56, fontWeight: 800, color: DARK_BG }}>LOGO</span>
        </div>
        <span style={{ fontFamily, fontSize: 110, fontWeight: 700, color: "white" }}>Ut <span style={{ color: TEAL }}>Lacus</span></span>
      </div>
    </AbsoluteFill>
  );
};

// S10 — "The all-in-one platform" (gray→white word reveal)
const S10_AllInOne: React.FC = () => {
  const frame = useCurrentFrame();
  const words = ["Nam", "vestibulum", "pretiums"];
  const stagger = 5;
  const fadeDuration = 4;

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG2 }}>
      {(() => {
        const zoomScale = interpolate(frame, [43, 50], [1, 2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0 28px", position: "absolute", left: "50%", top: "50%", transform: `translate(-50%, -50%) scale(${zoomScale})`, justifyContent: "center" }}>
            {words.map((word, i) => {
              const wordStart = 2 + i * stagger;
              const progress = interpolate(frame, [wordStart, wordStart + fadeDuration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const gray = Math.round(interpolate(progress, [0, 1], [80, 255]));
              return <span key={i} style={{ fontFamily, fontSize: 140, fontWeight: 700, color: `rgb(${gray},${gray},${gray})`, lineHeight: 1.1 }}>{word}</span>;
            })}
          </div>
        );
      })()}
    </AbsoluteFill>
  );
};

// S11 — "to create" (white→dark bg transition, arc gradient)
const S11_ToCreate: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const bgProgress = interpolate(frame, [20, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fontSize = interpolate(bgProgress, [0, 1], [160, 100]);
  const bgR = Math.round(interpolate(bgProgress, [0, 1], [255, 30]));
  const bgG = Math.round(interpolate(bgProgress, [0, 1], [255, 42]));
  const bgB = Math.round(interpolate(bgProgress, [0, 1], [255, 42]));
  const bgColor = `rgb(${bgR},${bgG},${bgB})`;
  const scale = interpolate(fadeIn, [0, 1], [0.8, 1]);

  // Slide out left in last 10 frames (75-85), ease-in (slow→fast)
  const slideProgress = interpolate(frame, [50, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const slideEased = slideProgress * slideProgress * slideProgress;
  const slideX = slideEased * -1400;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(calc(-50% + ${slideX}px), -50%) scale(${scale})`, fontFamily, fontSize, fontWeight: 700, background: `linear-gradient(to right, ${TEAL}, ${PURPLE}, ${TEAL})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", opacity: fadeIn, whiteSpace: "nowrap" }}>ut semper</div>
    </AbsoluteFill>
  );
};

// S12 — View counter (target: 2,151,709)
const S12_ViewCounter: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = ["lorem", "ipsum", "dolore"];
  const stagger = 6;
  const fadeDuration = 5;
  const targetCount = 2151709;
  const counterProgress = interpolate(frame, [20, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const currentCount = Math.round(counterProgress * targetCount);

  // Text enters from zoom 3500% to 100%
  const textZoom = interpolate(frame, [0, 12], [35, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const textOpacity = interpolate(frame, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG2 }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0 24px", justifyContent: "center", maxWidth: 800, transform: `scale(${textZoom})`, opacity: textOpacity }}>
          {words.map((word, i) => {
            const wordStart = 2 + i * stagger;
            const progress = interpolate(frame, [wordStart, wordStart + fadeDuration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const gray = Math.round(interpolate(progress, [0, 1], [80, 255]));
            return <span key={i} style={{ fontFamily, fontSize: 110, fontWeight: 600, color: `rgb(${gray},${gray},${gray})`, lineHeight: 0.85 }}>{word}</span>;
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, opacity: interpolate(frame, [15, 25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
          <svg width="90" height="90" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span style={{ fontFamily, fontSize: 96, fontWeight: 700, background: `linear-gradient(to right, #c8f06e, ${TEAL})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{currentCount.toLocaleString()}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// S13 — Clock icon
const S13_ClockIcon: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12, stiffness: 150 } });
  const scale = interpolate(s, [0, 1], [0.3, 1]);
  const rotation = interpolate(frame, [0, 30], [-15, 5], { extrapolateRight: "clamp" });
  const handAngle = frame * 6; // continuous rotation, never stops

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG2 }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`, opacity: s }}>
        <svg width="400" height="400" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke={TEAL} strokeWidth="4" />
          <circle cx="50" cy="50" r="38" fill={DARK_BG} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30 * Math.PI) / 180;
            return <line key={i} x1={50 + Math.sin(angle) * 33} y1={50 - Math.cos(angle) * 33} x2={50 + Math.sin(angle) * 37} y2={50 - Math.cos(angle) * 37} stroke="white" strokeWidth="2" strokeLinecap="round" />;
          })}
          <line x1="50" y1="50" x2={50 + Math.sin((handAngle * 0.3 * Math.PI) / 180) * 18} y2={50 - Math.cos((handAngle * 0.3 * Math.PI) / 180) * 18} stroke="white" strokeWidth="3" strokeLinecap="round" />
          <line x1="50" y1="50" x2={50 + Math.sin((handAngle * Math.PI) / 180) * 26} y2={50 - Math.cos((handAngle * Math.PI) / 180) * 26} stroke={TEAL} strokeWidth="2" strokeLinecap="round" />
          <circle cx="50" cy="50" r="3" fill={TEAL} />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

// S14 — "quickly with pre-made creation tools" (gray→white word reveal)
const S14_QuicklyTools: React.FC = () => {
  const frame = useCurrentFrame();
  const words = [
    { text: "viverra", gradient: true },
    { text: "nunc", gradient: false },
    { text: "blandit", gradient: false },
    { text: "lacinia", gradient: false },
    { text: "velit", gradient: false },
  ];
  const stagger = 6;
  const fadeDuration = 5;

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG2 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0 24px", position: "absolute", left: "8%", right: "8%", top: "42%", justifyContent: "center" }}>
        {words.map((word, i) => {
          const wordStart = 2 + i * stagger;
          const progress = interpolate(frame, [wordStart, wordStart + fadeDuration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const style: React.CSSProperties = { fontFamily, fontSize: 88, fontWeight: 700, lineHeight: 1.1 };
          if (word.gradient) {
            style.background = `linear-gradient(to right, ${TEAL}, ${PURPLE})`;
            style.WebkitBackgroundClip = "text";
            style.WebkitTextFillColor = "transparent";
            style.opacity = interpolate(progress, [0, 1], [0.3, 1]);
          } else {
            const gray = Math.round(interpolate(progress, [0, 1], [80, 255]));
            style.color = `rgb(${gray},${gray},${gray})`;
          }
          return <span key={i} style={style}>{word.text}</span>;
        })}
      </div>
    </AbsoluteFill>
  );
};

// S15 — Repeat scroll
const S15_RepeatScroll: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const text = "Nulla porta cursus,";
  const rowCount = 12;
  const fadeIn = spring({ frame, fps, config: { damping: 14, stiffness: 80 } });
  const scrollY = interpolate(frame, [0, 100], [200, -600], { extrapolateRight: "extend" });

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%, -50%) translateY(${scrollY}px)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, opacity: fadeIn }}>
        {Array.from({ length: rowCount }).map((_, i) => (
          <div key={i} style={{ fontFamily, fontSize: 80, fontWeight: 800, color: "white", whiteSpace: "nowrap", fontStyle: "italic", opacity: 0.15 + (1 - Math.abs(i - rowCount / 2) / (rowCount / 2)) * 0.85 }}>{text}</div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// S16 — TikTok collage — 3 panels, 2 sets of images (6 total), flicker transition
const S16_TikTokCollage: React.FC = () => {
  const frame = useCurrentFrame();
  const panelHeight = 1920 / 3;
  const colors1 = ["#2a3a3a", "#1e3030", "#2a2d32"];
  const colors2 = ["#3a2a2a", "#302a1e", "#322d2a"];
  const delays = [0, 8, 16];

  // Flicker at frame 50-58 (neon tube effect)
  const flickerPattern = [1, 0, 1, 0, 0, 1, 0, 1];
  const isFlickering = frame >= 50 && frame < 58;
  const flickerValue = isFlickering ? flickerPattern[frame - 50] : 1;
  const isSet2 = frame >= 58;
  const set2Start = 58;
  const delays2 = [0, 8, 16]; // stagger for set 2

  const currentColors = isSet2 ? colors2 : colors1;
  const setOffset = isSet2 ? 3 : 0; // Imagen 1-3 or 4-6

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG, overflow: "hidden" }}>
      {[2, 1, 0].map((i) => {
        // Set 1: slide in from right
        const enterProgress = interpolate(frame, [delays[i], delays[i] + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        // Set 2: also slide in from right after flicker
        const enter2Progress = isSet2 ? interpolate(frame, [set2Start + delays2[i], set2Start + delays2[i] + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
        const slideY = isSet2 ? interpolate(enter2Progress, [0, 1], [1920, 0]) : interpolate(enterProgress, [0, 1], [1920, 0]);
        const imgOpacity = isSet2
          ? interpolate(frame, [set2Start + delays2[i] + 8, set2Start + delays2[i] + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          : interpolate(frame, [delays[i] + 8, delays[i] + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={i} style={{
            position: "absolute",
            left: 0,
            top: i * panelHeight,
            width: "100%",
            height: panelHeight,
            backgroundColor: currentColors[i],
            transform: `translateY(${slideY}px)`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: 20,
            borderBottom: i < 2 ? "2px solid rgba(255,255,255,0.1)" : "none",
            opacity: flickerValue,
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: "hidden" }}>
              <Img src={NORA_IMAGES[i + setOffset]} style={{
                width: "100%", height: "100%", objectFit: "cover", objectPosition: "center center",
                opacity: imgOpacity,
              }} />
            </div>
            <span style={{
              fontFamily, fontSize: 88, fontWeight: 800, color: "white", zIndex: 1,
              textShadow: "0 4px 20px rgba(0,0,0,0.8)",
              opacity: imgOpacity,
            }}>{isSet2 ? ["ut", "semper", "sed"][i] : ["ut", "semper", "sed"][i]}</span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// S17 — Grid click reveal (3x2 grid, cursor clicks each cell with flicker)
const S17_GridClickReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  
  // 6 cells in order of click: top-left, top-center, top-right, bottom-left, bottom-center, bottom-right
  const cells = [
    {row: 0, col: 0}, {row: 0, col: 1},
    {row: 1, col: 0}, {row: 1, col: 1},
    {row: 2, col: 0}, {row: 2, col: 1},
  ];
  
  const CLICK_INTERVAL = 20; // frames between each click
  const FLICKER_DURATION = 8; // frames of flicker effect
  const GAP = 6;
  const GRID_W = width;
  const GRID_H = height;
  const CELL_W = (GRID_W - GAP) / 2;
  const CELL_H = (GRID_H - GAP * 2) / 3;
  const START_X = 0;
  const START_Y = 0;
  
  // Placeholder colors for each cell
  const cellColors = [TEAL, PURPLE, '#E8596A', '#F5A623', TEAL, PURPLE];
  
  // Cursor position — moves to each cell center
  const currentTarget = Math.min(Math.floor(frame / CLICK_INTERVAL), 5);
  const progressInClick = (frame - currentTarget * CLICK_INTERVAL) / CLICK_INTERVAL;
  
  const getCellCenter = (idx: number) => ({
    x: START_X + cells[idx].col * (CELL_W + GAP) + CELL_W / 2,
    y: START_Y + cells[idx].row * (CELL_H + GAP) + CELL_H / 2,
  });
  
  // Interpolate cursor between previous and current target
  const prevIdx = Math.max(0, currentTarget - 1);
  const curIdx = currentTarget;
  const prevCenter = getCellCenter(frame < CLICK_INTERVAL ? 0 : prevIdx);
  const curCenter = getCellCenter(curIdx);
  const moveProgress = frame < CLICK_INTERVAL 
    ? interpolate(frame, [0, CLICK_INTERVAL * 0.6], [0, 1], {extrapolateRight: 'clamp'})
    : interpolate(progressInClick, [0, 0.6], [0, 1], {extrapolateRight: 'clamp'});
  
  const cursorX = interpolate(moveProgress, [0, 1], [prevCenter.x, curCenter.x]);
  const cursorY = interpolate(moveProgress, [0, 1], [prevCenter.y, curCenter.y]);
  
  // Cursor click animation (scale bounce at arrival)
  const clickBounce = frame < 2 ? 1 : interpolate(
    progressInClick, [0.6, 0.7, 0.8], [1, 0.75, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );
  
  return (
    <AbsoluteFill style={{backgroundColor: DARK_BG}}>
      {/* Grid cells */}
      {cells.map((cell, i) => {
        const clickFrame = i * CLICK_INTERVAL;
        const revealed = frame >= clickFrame + CLICK_INTERVAL * 0.7;
        const flickering = frame >= clickFrame + CLICK_INTERVAL * 0.65 && frame < clickFrame + CLICK_INTERVAL * 0.65 + FLICKER_DURATION;
        
        const cellX = START_X + cell.col * (CELL_W + GAP);
        const cellY = START_Y + cell.row * (CELL_H + GAP);
        
        // Flicker: rapid opacity toggling
        const flickerOpacity = flickering 
          ? (Math.floor((frame - clickFrame) * 3) % 2 === 0 ? 1 : 0.2)
          : revealed ? 1 : 0;
        
        return (
          <div key={i} style={{
            position: 'absolute',
            left: cellX,
            top: cellY,
            width: CELL_W,
            height: CELL_H,
            borderRadius: 16,
            border: 'none',
            backgroundColor: 'transparent',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {/* Real image */}
            <Img src={NORA_IMAGES[i + 6]} style={{
              opacity: flickerOpacity,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: 12,
            }} />
          </div>
        );
      })}
      
      {/* Cursor */}
      <div style={{
        position: 'absolute',
        left: cursorX - 4,
        top: cursorY - 2,
        transform: `scale(${clickBounce})`,
        zIndex: 100,
        filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))',
      }}>
        <svg width="28" height="34" viewBox="0 0 28 34" fill="none">
          <path d="M2 2 L2 26 L8 20 L14 30 L18 28 L12 18 L20 18 Z" fill="white" stroke={DARK_BG} strokeWidth="1.5" />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

// S18 — Repurpose script
const S18_RepurposeScript: React.FC = () => {
  const frame = useCurrentFrame();
  const text = "Curabitur vel sapien";
  const charsPerFrame = 0.5;
  const visibleChars = Math.min(Math.floor(frame * charsPerFrame), text.length);
  const displayText = text.slice(0, visibleChars);

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG2 }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", maxWidth: 800, textAlign: "center" }}>
        <span style={{ fontFamily, fontSize: 88, fontWeight: 700, lineHeight: 0.85, background: `linear-gradient(to right, ${TEAL}, ${PURPLE})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{displayText}</span>
        <span style={{ display: "inline-block", width: 5, height: 80, backgroundColor: TEAL, marginLeft: 4, opacity: visibleChars < text.length || Math.floor(frame / 15) % 2 === 0 ? 1 : 0, verticalAlign: "middle", position: "relative", top: -6 }} />
      </div>
    </AbsoluteFill>
  );
};

// S19 — App editor
const S19_AppEditor: React.FC = () => <AppDemoPlaceholder title="Script Editor" subtitle="AI Text Editor" accentColor={PURPLE} />;

// S20 — Marquee bands
const S20_MarqueeBands: React.FC = () => {
  const frame = useCurrentFrame();
  const bandCount = 8;
  const speed = 3;

  return (
    <AbsoluteFill style={{ backgroundColor: "#111", overflow: "hidden" }}>
      {Array.from({ length: bandCount }).map((_, i) => {
        const isWhite = i % 2 === 0;
        const direction = isWhite ? 1 : -1;
        const offset = frame * speed * direction;
        const bandHeight = 1920 / bandCount;
        const textOnBand = isWhite ? "Cursus porta" : "vel lacus";
        return (
          <div key={i} style={{ position: "absolute", top: i * bandHeight, left: 0, width: "300%", height: bandHeight, backgroundColor: isWhite ? "white" : "#111", display: "flex", alignItems: "center", transform: `translateX(${(offset % 600) - 600}px)`, whiteSpace: "nowrap", overflow: "visible" }}>
            {Array.from({ length: 10 }).map((_, j) => (
              <span key={j} style={{ fontFamily, fontSize: bandHeight * 0.65, fontWeight: 800, color: isWhite ? "#111" : "white", marginRight: 60, display: "inline-flex", gap: 12 }}>
                {textOnBand.split(" ").map((w, k) => (
                  <span key={k} style={{ color: (isWhite && k === 1) || (!isWhite && k === 0) ? TEAL : undefined }}>{w}</span>
                ))}
              </span>
            ))}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// S21 — Stats collage
const S21_StatsCollage: React.FC = () => {
  const frame = useCurrentFrame();
  const GAP = 6;
  const stats = [
    { label: "Lectus Pretium", value: "12.4K" },
    { label: "Morbi Consequat", value: "48M+" },
    { label: "Donec Semper", value: "5,200" },
  ];
  const panelImages = [NORA_IMAGES[2], NORA_IMAGES[5], NORA_IMAGES[9]];
  const delays = [0, 8, 16];

  // 3 panels: stacked vertically for 9:16
  const panelH = (1920 - GAP * 2) / 3;
  const panels = [
    { left: 0, top: 0, width: 1080, height: panelH },
    { left: 0, top: panelH + GAP, width: 1080, height: panelH },
    { left: 0, top: (panelH + GAP) * 2, width: 1080, height: panelH },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG, overflow: "hidden" }}>
      {panels.map((panel, i) => {
        const enterProgress = interpolate(frame, [delays[i], delays[i] + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const slideX = interpolate(enterProgress, [0, 1], [1920, 0]);
        const textOpacity = interpolate(frame, [delays[i] + 8, delays[i] + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

        return (
          <div key={i} style={{
            position: "absolute",
            left: panel.left,
            top: panel.top,
            width: panel.width,
            height: panel.height,
            backgroundColor: "#1a1a1a",
            overflow: "hidden",
            transform: `translateX(${slideX}px)`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            alignItems: "flex-end",
            padding: 24,
            gap: 4,
          }}>
            <Img src={panelImages[i]} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 1 }} />
            <span style={{
              fontFamily, fontSize: i === 0 ? 90 : 72, fontWeight: 800, zIndex: 1,
              background: `linear-gradient(to right, ${TEAL}, ${PURPLE})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              opacity: textOpacity,
            }}>{stats[i].value}</span>
            <span style={{
              fontFamily, fontSize: 24, fontWeight: 500, color: "rgba(255,255,255,0.7)", zIndex: 1,
              opacity: textOpacity,
            }}>{stats[i].label}</span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// S21b — "SAME PIECE" split comparison
const S21b_SamePiece: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12, stiffness: 150 } });
  const flashOpacity = frame > 10 ? (Math.sin(frame * 0.4) > 0 ? 1 : 0.3) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: "50%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", opacity: s }}>
        <span style={{ fontFamily, fontSize: 80, fontWeight: 800, color: "#ff4444" }}>23K</span>
        <span style={{ fontFamily, fontSize: 36, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>VIEWS</span>
      </div>
      <div style={{ position: "absolute", left: "50%", top: "10%", width: 2, height: "80%", backgroundColor: "rgba(255,255,255,0.2)" }} />
      <div style={{ position: "absolute", right: 0, top: 0, width: "50%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", opacity: s }}>
        <span style={{ fontFamily, fontSize: 80, fontWeight: 800, color: TEAL }}>7M</span>
        <span style={{ fontFamily, fontSize: 36, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>VIEWS</span>
      </div>
      <div style={{ position: "absolute", bottom: "18%", left: "50%", transform: "translateX(-50%)", fontFamily, fontSize: 64, fontWeight: 800, color: "#FFD700", opacity: flashOpacity, whiteSpace: "nowrap" }}>SAME PIECE</div>
    </AbsoluteFill>
  );
};

// S22 — Typewriter
const S22_Typewriter: React.FC = () => {
  const frame = useCurrentFrame();
  const text = "Sed nunc cursus";
  const charsPerFrame = 0.4;
  const visibleChars = Math.min(Math.floor(frame * charsPerFrame), text.length);
  const displayText = text.slice(0, visibleChars);
  const cursorVisible = Math.floor(frame / 15) % 2 === 0 || visibleChars < text.length;

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG2 }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", alignItems: "center", maxWidth: 700, textAlign: "center", flexWrap: "wrap", justifyContent: "center" }}>
        <span style={{ fontFamily, fontSize: 96, fontWeight: 700, color: "white", lineHeight: 0.85 }}>{displayText}</span>
        <span style={{ display: "inline-block", width: 6, height: 110, backgroundColor: TEAL, marginLeft: 4, opacity: cursorVisible ? 1 : 0 }} />
      </div>
    </AbsoluteFill>
  );
};

// S23 — App create video
const S23_AppCreateVideo: React.FC = () => <AppDemoPlaceholder title="Create New Video" subtitle="Video Creation" accentColor={TEAL} />;

// S24 — AI toggle
const S24_AIToggle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const textSpring = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const toggleProgress = interpolate(frame, [20, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const toggleX = interpolate(toggleProgress, [0, 1], [0, 28]);
  const toggleBg = `rgb(${Math.round(interpolate(toggleProgress, [0, 1], [100, 92]))},${Math.round(interpolate(toggleProgress, [0, 1], [100, 234]))},${Math.round(interpolate(toggleProgress, [0, 1], [100, 175]))})`;
  const fadeOut = interpolate(frame, [52, 57], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exitY = interpolate(frame, [52, 57], [0, -150], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG2 }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(calc(-50% + ${interpolate(textSpring, [0, 1], [-100, 0])}px), calc(-50% + ${exitY}px))`, display: "flex", flexDirection: "column", alignItems: "center", gap: 40, opacity: textSpring * fadeOut }}>
        <span style={{ fontFamily, fontSize: 88, fontWeight: 700, color: "white", textAlign: "center", maxWidth: 700, lineHeight: 0.85, display: "block" }}>Nec aliquet volutpat enim</span>
        <div style={{ width: 210, height: 114, borderRadius: 57, backgroundColor: toggleBg, padding: 12 }}>
          <div style={{ width: 90, height: 90, borderRadius: "50%", backgroundColor: "white", transform: `translateX(${toggleX * 3}px)`, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// S24b — Generate button + loading
const S24b_GenerateButton: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const btnSpring = spring({ frame, fps, config: { damping: 12, stiffness: 150 } });
  const btnScale = interpolate(btnSpring, [0, 1], [0.5, 1]);
  const clicked = frame > 25;
  const clickScale = clicked ? interpolate(frame, [25, 28, 30], [1, 0.95, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const loadingOpacity = interpolate(frame, [30, 35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const spinAngle = (frame - 30) * 8;

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG2 }}>
      <div style={{ position: "absolute", top: clicked ? "35%" : "50%", left: "50%", transform: `translate(-50%, -50%) scale(${btnScale * clickScale})`, backgroundColor: "#22c55e", borderRadius: 16, padding: "28px 70px", cursor: "pointer", boxShadow: "0 8px 30px rgba(34,197,94,0.4)", transition: "top 0.3s" }}>
        <span style={{ fontFamily, fontSize: 48, fontWeight: 700, color: "white" }}>Generate Video</span>
      </div>
      {clicked && (
        <div style={{ position: "absolute", top: "55%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, opacity: loadingOpacity }}>
          <svg width="60" height="60" viewBox="0 0 60 60" style={{ transform: `rotate(${spinAngle}deg)` }}>
            <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
            <path d="M30 6 A24 24 0 0 1 54 30" fill="none" stroke={TEAL} strokeWidth="4" strokeLinecap="round" />
          </svg>
          <span style={{ fontFamily, fontSize: 28, fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>Preparing everything...</span>
        </div>
      )}
    </AbsoluteFill>
  );
};

// S24c — "Generate your Masterpiece"
const S24c_GenerateMasterpiece: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const scale = interpolate(s, [0, 1], [0.7, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG2 }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(-50%, -50%) scale(${scale})`, fontFamily, fontSize: 88, fontWeight: 800, background: "linear-gradient(to right, #22c55e, #3b82f6, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", opacity: s, textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap" }}>
        Praesent nunc<br />Vestibulum
      </div>
    </AbsoluteFill>
  );
};

// S25 — Video on phone
const S25_VideoOnPhone: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12, stiffness: 100, mass: 0.7 } });
  const scale = interpolate(s, [0, 1], [0.6, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(-50%, -50%) scale(${scale})`, opacity: s }}>
        <div style={{ width: 700, height: 1400, borderRadius: 44, backgroundColor: "#111", border: "4px solid #333", padding: "50px 14px 36px", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
          <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", width: 120, height: 24, borderRadius: 12, backgroundColor: "#000" }} />
          <div style={{ flex: 1, borderRadius: 12, overflow: "hidden", position: "relative" }}>
            <Img src={NORA_CREATIVAS[1]} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center center" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-around", paddingTop: 12 }}>
            {["Home", "Search", "Post", "Inbox", "Profile"].map((_, i) => (
              <div key={i} style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: i === 2 ? TEAL : "rgba(255,255,255,0.15)" }} />
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// S26 — Easy to use
const S26_EasyToUse: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12, stiffness: 150, mass: 0.5 } });
  const scale = interpolate(s, [0, 1], [0.6, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG2 }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(-50%, -50%) scale(${scale})`, fontFamily, fontSize: 110, fontWeight: 800, color: "white", opacity: s, whiteSpace: "nowrap" }}>Consectetur</div>
    </AbsoluteFill>
  );
};

// S27 — App video editor
const S27_AppVideoEditor: React.FC = () => <AppDemoPlaceholder title="Video Editor" subtitle="Drag & Drop Editor" accentColor={PURPLE} />;

// S27b — Social card with floating icons
const S27b_SocialCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cardSpring = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const cardScale = interpolate(cardSpring, [0, 1], [0.7, 1]);

  const icons = [
    { emoji: "▶", color: "#ff0000", x: -320, y: -180, size: 50 },
    { emoji: "👍", color: "#1877f2", x: 320, y: -120, size: 44 },
    { emoji: "❤️", color: "#ff3040", x: -280, y: 160, size: 40 },
    { emoji: "🔔", color: "#ffd700", x: 300, y: 180, size: 42 },
    { emoji: "♪", color: "#000", x: 340, y: -10, size: 46 },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG2 }}>
      {icons.map((icon, i) => {
        const floatY = Math.sin(frame * 0.06 + i * 1.5) * 15;
        const floatX = Math.cos(frame * 0.04 + i * 2) * 8;
        const iconSpring = spring({ frame: Math.max(0, frame - 5 - i * 3), fps, config: { damping: 12, stiffness: 120 } });
        return (
          <div key={i} style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(${icon.x + floatX}px, ${icon.y + floatY}px)`, width: icon.size, height: icon.size, borderRadius: "50%", backgroundColor: icon.color === "#000" ? "#111" : icon.color + "20", display: "flex", justifyContent: "center", alignItems: "center", fontSize: icon.size * 0.5, opacity: iconSpring, boxShadow: `0 4px 16px ${icon.color}40` }}>
            <span>{icon.emoji}</span>
          </div>
        );
      })}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(-50%, -50%) scale(${cardScale})`, width: 400, backgroundColor: "white", borderRadius: 20, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", opacity: cardSpring }}>
        <div style={{ width: "100%", height: 300, backgroundColor: "#e0e0e0", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.1)", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div style={{ width: 0, height: 0, borderLeft: "18px solid rgba(0,0,0,0.3)", borderTop: "11px solid transparent", borderBottom: "11px solid transparent", marginLeft: 4 }} />
          </div>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", gap: 24, alignItems: "center" }}>
          <span style={{ fontSize: 18, color: "#333" }}>❤️ 27k</span>
          <span style={{ fontSize: 18, color: "#333" }}>💬 642</span>
          <span style={{ fontSize: 18, color: "#333", marginLeft: "auto" }}>🔖</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// S28 — New video every day (gray→white word reveal)
const S28_NewVideoEveryDay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const PARTICLE_COUNT = 28;
  const textDelay = 10;
  const words = ["Sed", "a", "vel", "porta", "-", "nulla", "sem"];
  const wordStagger = 3;

  // Zoom 3500% in last 10 frames
  const zoomStart = 80;
  const textZoom = interpolate(frame, [zoomStart, zoomStart + 10], [1, 35], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG2, overflow: "hidden" }}>
      {/* Particles - same as S04 */}
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
        const px = pseudoRandom(i * 3 + 10) * 100;
        const py = pseudoRandom(i * 3 + 11) * 100;
        const size = (6 + pseudoRandom(i * 3 + 12) * 20) * 2;
        const speed = 0.3 + pseudoRandom(i * 7 + 5) * 0.7;
        const floatY = Math.sin(frame * speed * 0.08 + i) * 40;
        const floatX = Math.cos(frame * speed * 0.06 + i * 2) * 30;
        const isBig = size > 16;
        const particleColor = isBig ? "#7ac8a0" : "#4efa90";
        const particleOpacity = 0.3 + pseudoRandom(i * 5 + 3) * 0.6;
        const enterDelay = pseudoRandom(i * 11 + 7) * 15;
        const enterProgress = interpolate(frame, [enterDelay, enterDelay + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const particleScale = interpolate(enterProgress, [0, 1], [10, 1]);
        return (
          <div key={i} style={{ position: "absolute", left: `${px}%`, top: `${py}%`, width: size, height: size, borderRadius: "50%", backgroundColor: particleColor, opacity: particleOpacity * enterProgress, transform: `translate(${floatX}px, ${floatY}px) scale(${particleScale})` }} />
        );
      })}
      {/* Text with spring per word + zoom */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(-50%, -50%) scale(${textZoom})`, display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "baseline", gap: "0 18px", maxWidth: 700 }}>
        {words.map((word, i) => {
          const delay = textDelay + i * wordStagger;
          const s = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 12, stiffness: 180, mass: 0.5 } });
          const y = interpolate(s, [0, 1], [-200, 0]);
          return (
            <span key={i} style={{ fontFamily, fontSize: 130, fontWeight: 700, color: "white", display: "inline-block", transform: `translateY(${y}px)`, opacity: interpolate(s, [0, 0.2], [0, 1], { extrapolateRight: "clamp" }), lineHeight: 0.85 }}>{word}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// S29 — App automations
const S29_AppAutomations: React.FC = () => <AppDemoPlaceholder title="Automations" subtitle="Daily Video Generation" accentColor={TEAL} />;

// S30 — Auto button (WHITE pill, dark text)
const S30_AutoButton: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const DOTS = 10;
  const btnSpring = spring({ frame, fps, config: { damping: 12, stiffness: 150 } });
  const btnScale = interpolate(btnSpring, [0, 1], [0.5, 1]);
  const glowOpacity = 0.2 + Math.sin(frame * 0.08) * 0.1;

  // Cursor enters at frame 35, clicks at frame 50
  const cursorOpacity = interpolate(frame, [35, 42], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cursorX = interpolate(frame, [35, 48], [400, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cursorY = interpolate(frame, [35, 48], [200, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const clickBounce = frame >= 50 && frame <= 53 ? interpolate(frame, [50, 51, 53], [1, 0.75, 1]) : 1;
  
  // After click (frame 50): button turns green with glow
  const clicked = frame >= 50;
  const greenProgress = interpolate(frame, [50, 55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const btnBg = clicked ? `rgb(${Math.round(interpolate(greenProgress, [0, 1], [255, 34]))}, ${Math.round(interpolate(greenProgress, [0, 1], [255, 197]))}, ${Math.round(interpolate(greenProgress, [0, 1], [255, 94]))})` : "white";
  const textColor = clicked ? `rgba(255,255,255,${greenProgress})` : "#1a1a1a";
  const greenGlow = clicked ? `0 0 ${30 + greenProgress * 40}px rgba(34,197,94,${greenProgress * 0.6}), 0 0 ${60 + greenProgress * 80}px rgba(34,197,94,${greenProgress * 0.3})` : "0 8px 30px rgba(255,255,255,0.15)";

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG2 }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 700, height: 400, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(255,255,255,0.15) 0%, transparent 70%)", opacity: glowOpacity }} />
      {Array.from({ length: DOTS }).map((_, i) => {
        const angle = (i / DOTS) * Math.PI * 2 + frame * 0.015;
        const radius = 180 + pseudoRandom(i * 11) * 100;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const size = 6 + pseudoRandom(i * 7) * 8;
        return <div key={i} style={{ position: "absolute", top: "50%", left: "50%", width: size, height: size, borderRadius: "50%", backgroundColor: i % 3 === 0 ? PURPLE : "rgba(255,255,255,0.3)", transform: `translate(${x}px, ${y}px)`, opacity: 0.6 + pseudoRandom(i * 3) * 0.4 }} />;
      })}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(-50%, -50%) scale(${btnScale})`, backgroundColor: btnBg, borderRadius: 60, padding: "30px 80px", display: "flex", justifyContent: "center", alignItems: "center", boxShadow: greenGlow }}>
        <span style={{ fontFamily, fontSize: 64, fontWeight: 700, color: clicked ? `rgba(${Math.round(interpolate(greenProgress, [0, 1], [26, 255]))},${Math.round(interpolate(greenProgress, [0, 1], [26, 255]))},${Math.round(interpolate(greenProgress, [0, 1], [26, 255]))})` : "#1a1a1a" }}>pellentesque</span>
      </div>
      {/* Cursor */}
      <div style={{ position: "absolute", top: "50%", left: "55%", transform: `translate(${cursorX}px, ${cursorY}px) scale(${clickBounce})`, opacity: cursorOpacity, zIndex: 10, filter: "drop-shadow(1px 2px 4px rgba(0,0,0,0.5))" }}>
        <svg width="28" height="34" viewBox="0 0 28 34" fill="none">
          <path d="M2 2 L2 26 L8 20 L14 30 L18 28 L12 18 L20 18 Z" fill="white" stroke="#333" strokeWidth="1.5" />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

// S31 — App audio
const S31_AppAudio: React.FC = () => <AppDemoPlaceholder title="Select Audio" subtitle="Music Library" accentColor={PURPLE} />;

// S32 — Receive inbox (gray→white word reveal)
const S32_ReceiveInbox: React.FC = () => {
  const frame = useCurrentFrame();
  const words = ["sed", "viverra", "nunc", "dolor", "ut", "amet", "Morbi"];
  const stagger = 4;
  const fadeDuration = 6;
  const underlineWidth = interpolate(frame, [35, 50], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG2, justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 28px", justifyContent: "center", padding: "0 60px", maxWidth: "100%" }}>
        {words.map((word, i) => {
          const wordStart = 2 + i * stagger;
          const progress = interpolate(frame, [wordStart, wordStart + fadeDuration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const slideY = interpolate(progress, [0, 1], [100, 0]);
          return (
            <span key={i} style={{ fontFamily, fontSize: 88, fontWeight: 700, color: "white", lineHeight: 1.15, position: "relative", opacity: progress, transform: `translateY(${slideY}px)`, display: "inline-block" }}>
              {word}
              {word === "Morbi" && <div style={{ position: "absolute", bottom: -6, left: 0, height: 8, width: `${underlineWidth}%`, backgroundColor: TEAL, borderRadius: 4 }} />}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// S32b — Mac notification slide-in
const S32b_MacNotification: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slideSpring = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 14, stiffness: 100 } });
  const slideX = interpolate(slideSpring, [0, 1], [500, 0]);
  const fadeOut = interpolate(frame, [45, 55], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG2 }}>
      <div style={{ position: "absolute", top: 60, right: 40, transform: `translateX(${slideX}px)`, opacity: fadeOut, width: 380, backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 14, padding: "16px 20px", display: "flex", gap: 14, alignItems: "flex-start", boxShadow: "0 8px 40px rgba(0,0,0,0.4)", backdropFilter: "blur(20px)" }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: TEAL, flexShrink: 0, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid white" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily, fontSize: 15, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>Morbi Consequat Porta</div>
          <div style={{ fontFamily, fontSize: 13, fontWeight: 400, color: "#666" }}>Cursus vel semper...</div>
        </div>
        <span style={{ fontFamily, fontSize: 12, color: "#999", flexShrink: 0 }}>now</span>
      </div>
    </AbsoluteFill>
  );
};

// S33 — Boost engagement (gray→white word reveal)
const S33_BoostEngagement: React.FC = () => {
  const frame = useCurrentFrame();
  const words = ["Fusce", "quis", "vestibulum"];
  const stagger = 4;
  const fadeDuration = 6;
  // Diagonal line from bottom-right to top-left, drawing progressively
  const lineProgress = interpolate(frame, [10, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lineX = interpolate(lineProgress, [0, 1], [1920, 0]);
  const lineY = interpolate(lineProgress, [0, 1], [1080, 0]);

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG2, justifyContent: "center", alignItems: "center" }}>
      {/* Diagonal green line */}
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", top: 0, left: 0 }}>
        <line x1="1920" y1="1080" x2={lineX} y2={lineY} stroke={TEAL} strokeWidth="6" strokeLinecap="round" opacity={0.8} />
      </svg>
      {/* Text filling screen */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 28px", justifyContent: "center", padding: "0 60px", maxWidth: "100%" }}>
        {words.map((word, i) => {
          const wordStart = 2 + i * stagger;
          const progress = interpolate(frame, [wordStart, wordStart + fadeDuration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const slideY = interpolate(progress, [0, 1], [100, 0]);
          return <span key={i} style={{ fontFamily, fontSize: 88, fontWeight: 700, color: "white", lineHeight: 1.15, opacity: progress, transform: `translateY(${slideY}px)`, display: "inline-block" }}>{word}</span>;
        })}
      </div>
    </AbsoluteFill>
  );
};

// S34 — Battery turbocharge — FIX #9: Red→Yellow→Green, 10%→65% charge
const S34_BatteryTurbocharge: React.FC = () => {
  const frame = useCurrentFrame();
  const words = ["&", "pellentesque", "nunc", "cursus", "vitae", "semper"];
  const stagger = 4;
  const fadeDuration = 6;
  const lastWordEnd = 2 + (words.length - 1) * stagger + fadeDuration; // ~30

  // Battery charges after text is done, reaches 100%
  const chargeProgress = interpolate(frame, [lastWordEnd + 5, 110], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // 3-color transition: Red → Yellow → Green
  let batteryR: number, batteryG: number, batteryB: number;
  if (chargeProgress < 0.5) {
    const t = chargeProgress * 2;
    batteryR = Math.round(interpolate(t, [0, 1], [232, 232]));
    batteryG = Math.round(interpolate(t, [0, 1], [84, 212]));
    batteryB = Math.round(interpolate(t, [0, 1], [84, 84]));
  } else {
    const t = (chargeProgress - 0.5) * 2;
    batteryR = Math.round(interpolate(t, [0, 1], [232, 92]));
    batteryG = Math.round(interpolate(t, [0, 1], [212, 200]));
    batteryB = Math.round(interpolate(t, [0, 1], [84, 92]));
  }
  const batteryColor = `rgb(${batteryR},${batteryG},${batteryB})`;
  const fillWidth = interpolate(chargeProgress, [0, 1], [8, 248]); // 100% fill (inner width: 30 to 278)
  const batteryOpacity = interpolate(frame, [lastWordEnd, lastWordEnd + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG2, justifyContent: "center", alignItems: "center" }}>
      {/* Text - large, fade in from top */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 28px", justifyContent: "center", padding: "0 60px", maxWidth: "100%", marginBottom: 60 }}>
        {words.map((word, i) => {
          const wordStart = 2 + i * stagger;
          const progress = interpolate(frame, [wordStart, wordStart + fadeDuration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const slideY = interpolate(progress, [0, 1], [-100, 0]);
          return <span key={i} style={{ fontFamily, fontSize: 100, fontWeight: 700, color: "white", lineHeight: 1.15, opacity: progress, transform: `translateY(${slideY}px)`, display: "inline-block" }}>{word}</span>;
        })}
      </div>
      {/* Battery - larger */}
      <div style={{ opacity: batteryOpacity }}>
        <svg width="360" height="210" viewBox="0 0 360 210">
          <rect x="15" y="30" width="270" height="150" rx="24" fill="none" stroke={batteryColor} strokeWidth="8" />
          <rect x="285" y="72" width="36" height="66" rx="9" fill={batteryColor} />
          <rect x="30" y="48" width={fillWidth} height="114" rx="12" fill={batteryColor} />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

// S35 — Get it now — FIX #10: Gray→white word reveal for GET IT, pill button for NOW
const S35_GetItNow: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Gray→white word reveal for "GET" and "IT"
  const getWords = ["SED", "UT"];
  const stagger = 5;
  const fadeDuration = 4;

  // NOW pill springs in after IT is white
  const nowDelay = 2 + getWords.length * stagger + 2;
  const nowSpring = spring({ frame: Math.max(0, frame - nowDelay), fps, config: { damping: 12, stiffness: 120 } });
  const nowScale = interpolate(nowSpring, [0, 1], [0.5, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG2 }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", alignItems: "center", gap: 30 }}>
        {getWords.map((word, i) => {
          const wordStart = 2 + i * stagger;
          const progress = interpolate(frame, [wordStart, wordStart + fadeDuration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const gray = Math.round(interpolate(progress, [0, 1], [80, 255]));
          return <span key={i} style={{ fontFamily, fontSize: 96, fontWeight: 800, color: `rgb(${gray},${gray},${gray})`, letterSpacing: 6 }}>{word}</span>;
        })}
        <div style={{ backgroundColor: "white", borderRadius: 50, padding: "18px 50px", transform: `scale(${nowScale})`, opacity: nowSpring }}>
          <span style={{ fontFamily, fontSize: 80, fontWeight: 800, color: DARK_BG2, letterSpacing: 4 }}>NEC</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// FIX #8: Glitch Transition (5 frames) — chromatic aberration + pixel scatter
const GlitchTransition: React.FC = () => {
  const frame = useCurrentFrame();
  const PARTICLE_COUNT = 24;

  // Chromatic aberration offset increases then decreases
  const aberration = frame <= 2
    ? interpolate(frame, [0, 2], [0, 20], { extrapolateRight: "clamp" })
    : interpolate(frame, [2, 4], [20, 0], { extrapolateRight: "clamp" });

  // Scatter intensity
  const scatter = frame <= 2
    ? interpolate(frame, [0, 2], [0, 1], { extrapolateRight: "clamp" })
    : interpolate(frame, [2, 4], [1, 0], { extrapolateRight: "clamp" });

  // Fade to dark at end
  const fadeToDark = interpolate(frame, [3, 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG2, overflow: "hidden" }}>
      {/* RGB channel separation — 3 offset copies of a central shape */}
      {/* Red channel */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        width: 200, height: 200, borderRadius: 20,
        border: "4px solid rgba(255,0,0,0.6)",
        transform: `translate(calc(-50% - ${aberration}px), -50%)`,
        opacity: 0.8,
      }} />
      {/* Green channel */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        width: 200, height: 200, borderRadius: 20,
        border: "4px solid rgba(0,255,0,0.6)",
        transform: `translate(-50%, -50%)`,
        opacity: 0.8,
      }} />
      {/* Blue channel */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        width: 200, height: 200, borderRadius: 20,
        border: "4px solid rgba(0,0,255,0.6)",
        transform: `translate(calc(-50% + ${aberration}px), -50%)`,
        opacity: 0.8,
      }} />

      {/* Scattered pixel particles */}
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
        const angle = pseudoRandom(i * 7) * Math.PI * 2;
        const dist = (40 + pseudoRandom(i * 13) * 400) * scatter;
        const px = 960 + Math.cos(angle) * dist;
        const py = 540 + Math.sin(angle) * dist;
        const size = 6 + pseudoRandom(i * 11) * 10;
        const colors = ["#00ff88", "#aa55ff", "#ff3366", "#55ffaa", "#ff00ff"];
        const color = colors[i % colors.length];
        return (
          <div key={i} style={{
            position: "absolute",
            left: px,
            top: py,
            width: size,
            height: size,
            backgroundColor: color,
            opacity: scatter * 0.8,
          }} />
        );
      })}

      {/* Neon fragments (frames 2-3) */}
      {frame >= 2 && frame <= 3 && (
        <>
          <div style={{ position: "absolute", top: "20%", left: "10%", width: 300, height: 4, backgroundColor: "#00ff88", opacity: 0.7 }} />
          <div style={{ position: "absolute", top: "60%", left: "40%", width: 200, height: 4, backgroundColor: "#aa55ff", opacity: 0.7 }} />
          <div style={{ position: "absolute", top: "80%", left: "60%", width: 250, height: 4, backgroundColor: "#ff3366", opacity: 0.5 }} />
        </>
      )}

      {/* Fade to dark */}
      <AbsoluteFill style={{ backgroundColor: DARK_BG2, opacity: fadeToDark }} />
    </AbsoluteFill>
  );
};

// S36 — Final logo
const S36_FinalLogo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const scale = interpolate(s, [0, 1], [0.7, 1]);
  const PARTICLE_COUNT = 50;
  const fadeOut = interpolate(frame, [120, 150], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG2 }}>
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
        const px = pseudoRandom(i * 17 + 1) * 100;
        const py = pseudoRandom(i * 17 + 2) * 100;
        const size = 3 + pseudoRandom(i * 17 + 3) * 8;
        const speed = 0.4 + pseudoRandom(i * 7) * 0.6;
        const floatY = Math.sin(frame * speed * 0.06 + i * 1.5) * 30;
        const floatX = Math.cos(frame * speed * 0.04 + i * 2.3) * 20;
        const color = i % 4 === 0 ? TEAL : i % 4 === 1 ? PURPLE : "rgba(255,255,255,0.15)";
        return <div key={i} style={{ position: "absolute", left: `${px}%`, top: `${py}%`, width: size, height: size, borderRadius: "50%", backgroundColor: color, transform: `translate(${floatX}px, ${floatY}px)`, opacity: (0.4 + pseudoRandom(i * 5) * 0.5) * fadeOut }} />;
      })}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(-50%, -50%) scale(${scale})`, display: "flex", alignItems: "center", gap: 24, opacity: s * fadeOut }}>
        <div style={{ width: 90, height: 90, borderRadius: 14, border: `3px solid ${TEAL}`, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid white", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: "white" }} />
          </div>
        </div>
        <span style={{ fontFamily, fontSize: 88, fontWeight: 700, color: "white" }}>Ut <span style={{ color: TEAL }}>Ipsum</span></span>
      </div>
    </AbsoluteFill>
  );
};

// S_NEW1 — Split: image left + gradient text right (slide-in)
const SNew1_SplitImageText: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Image panel slides in from left
  const imgSpring = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const imgX = interpolate(imgSpring, [0, 1], [-960, 0]);

  // Text slides in from right with stagger
  const words = ["Aliquet", "ut", "praesent"];
  const stagger = 5;
  const fadeDuration = 5;
  const textDelay = 8;

  // Subtle zoom on image
  const imgScale = interpolate(frame, [0, 75], [1.05, 1.15], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG }}>
      {/* Image panel — top half */}
      <div style={{
        position: "absolute", left: 0, top: 0, width: "100%", height: "50%",
        overflow: "hidden",
        transform: `translateY(${interpolate(imgSpring, [0, 1], [-960, 0])}px)`,
      }}>
        <Img src={NORA_IMAGES[0]} style={{
          width: "100%", height: "100%", objectFit: "cover",
          transform: `scale(${imgScale})`,
        }} />
      </div>
      {/* Text — bottom half, centered */}
      <div style={{
        position: "absolute", left: "50%", top: "calc(50% + 60px)", transform: "translateX(-50%)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: -10,
      }}>
        {words.map((word, i) => {
          const wordStart = textDelay + i * stagger;
          const progress = interpolate(frame, [wordStart, wordStart + fadeDuration], [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const slideY = interpolate(progress, [0, 1], [100, 0]);
          return (
            <span key={i} style={{
              fontFamily, fontSize: 110, fontWeight: 800, lineHeight: 0.85,
              color: "white",
              opacity: progress,
              transform: `translateY(${slideY}px)`,
              display: "inline-block",
            }}>{word}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// S_NEW2 — Fullscreen image bg + large text overlay (word reveal gray→white)
const SNew2_ImageWithOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Image enters with spring (elastic) + slow zoom
  const imgSpring = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const imgOpacity = interpolate(imgSpring, [0, 1], [0, 1]);
  const imgEntryScale = interpolate(imgSpring, [0, 1], [1.3, 1.0]);
  const imgDrift = interpolate(frame, [0, 75], [1.0, 1.08], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const imgScale = imgEntryScale * imgDrift;

  // Words fade in with slide from bottom
  const words = ["Vestibulum", "semper"];
  const stagger = 6;
  const fadeDuration = 6;

  // Dark vignette for text readability
  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG }}>
      {/* Background image */}
      <Img src={NORA_IMAGES[3]} style={{
        position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
        objectFit: "cover", opacity: imgOpacity * 0.45,
        transform: `scale(${imgScale})`,
      }} />
      {/* Dark gradient overlay from bottom */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "60%",
        background: `linear-gradient(to top, ${DARK_BG}ee, transparent)`,
      }} />
      {/* Text — fills screen */}
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        display: "flex", flexWrap: "wrap", gap: "0px 36px", justifyContent: "center",
        padding: "0 60px", maxWidth: "100%",
      }}>
        {words.map((word, i) => {
          const wordStart = 10 + i * stagger;
          const progress = interpolate(frame, [wordStart, wordStart + fadeDuration], [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const slideY = interpolate(progress, [0, 1], [100, 0]);
          const gray = Math.round(interpolate(progress, [0, 1], [80, 255]));
          return (
            <span key={i} style={{
              fontFamily, fontSize: 140, fontWeight: 800, lineHeight: 0.85,
              color: `rgb(${gray},${gray},${gray})`,
              opacity: progress,
              transform: `translateY(${slideY}px)`,
              display: "inline-block",
            }}>{word}</span>
          );
        })}
      </div>
      {/* Accent line under text */}
      {(() => {
        const lineWidth = interpolate(frame, [25, 50], [0, 480], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div style={{
            position: "absolute", bottom: "12%", left: "50%",
            transform: "translateX(-50%)",
            width: lineWidth, height: 6, borderRadius: 3,
            background: `linear-gradient(to right, ${TEAL}, ${PURPLE})`,
          }} />
        );
      })()}
    </AbsoluteFill>
  );
};

// S_NEW3 — Rounded image frame center + typewriter text below
const SNew3_FramedImageTypewriter: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Image frame springs in from scale 0.3
  const imgSpring = spring({ frame, fps, config: { damping: 12, stiffness: 100, mass: 0.7 } });
  const imgScale = interpolate(imgSpring, [0, 1], [0.3, 1]);

  // Glow ring around image
  const glowPulse = 0.4 + Math.sin(frame * 0.1) * 0.2;

  // Typewriter text
  const text = "Ut lacus, vel porta";
  const charsPerFrame = 0.45;
  const typeDelay = 20;
  const visibleChars = Math.min(Math.floor(Math.max(0, frame - typeDelay) * charsPerFrame), text.length);
  const displayText = text.slice(0, visibleChars);
  const cursorVisible = frame >= typeDelay && (visibleChars < text.length || Math.floor(frame / 15) % 2 === 0);

  // Floating particles (subtle)
  const PARTICLE_COUNT = 12;

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BG, overflow: "hidden" }}>
      {/* Subtle particles */}
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
        const px = pseudoRandom(i * 3 + 50) * 100;
        const py = pseudoRandom(i * 3 + 51) * 100;
        const size = 4 + pseudoRandom(i * 3 + 52) * 8;
        const floatY = Math.sin(frame * 0.05 + i * 2) * 20;
        const color = i % 3 === 0 ? TEAL : i % 3 === 1 ? PURPLE : "rgba(255,255,255,0.15)";
        const enterP = interpolate(frame, [i * 2, i * 2 + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={i} style={{
            position: "absolute", left: `${px}%`, top: `${py}%`,
            width: size, height: size, borderRadius: "50%",
            backgroundColor: color, opacity: 0.4 * enterP,
            transform: `translateY(${floatY}px)`,
          }} />
        );
      })}

      {/* Centered group: image + text */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: `translate(-50%, -50%) scale(${imgScale})`,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 30,
      }}>
        {/* Glow ring */}
        <div style={{
          position: "absolute", top: 0, left: "50%",
          transform: "translateX(-50%)",
          width: 640, height: 640, borderRadius: 32,
          boxShadow: `0 0 ${40 + glowPulse * 30}px ${TEAL}${Math.round(glowPulse * 255).toString(16).padStart(2, "0")},
                       0 0 ${80 + glowPulse * 60}px ${PURPLE}${Math.round(glowPulse * 180).toString(16).padStart(2, "0")}`,
        }} />

        {/* Image in rounded frame */}
        <div style={{
          width: 620, height: 620, borderRadius: 28,
          overflow: "hidden",
          border: `3px solid ${TEAL}40`,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          opacity: imgSpring,
        }}>
          <Img src={NORA_IMAGES[7]} style={{
            width: "100%", height: "100%", objectFit: "cover",
          }} />
        </div>

        {/* Typewriter text */}
        <div style={{
          maxWidth: 800, textAlign: "center",
          display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center",
        }}>
        <span style={{
          fontFamily, fontSize: 120, fontWeight: 700, lineHeight: 0.85,
          background: `linear-gradient(to right, ${TEAL}, ${PURPLE})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>{displayText}</span>
        <span style={{
          display: "inline-block", width: 5, height: 60,
          backgroundColor: TEAL, marginLeft: 4,
          opacity: cursorVisible ? 1 : 0,
          verticalAlign: "middle",
        }} />
      </div>
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPOSITION — 36 scenes + 2 transitions, 2510 frames = ~83.7s @ 30fps
// ═══════════════════════════════════════════════════════════════════════════
export const EffectsBibleVertical: React.FC = () => {
  return (
    <GlitchWrapper>
      <Sequence name="01 - Word reveal" from={0} durationInFrames={55}><S01_WordReveal /></Sequence>
      <Sequence name="02 - Impact zoom" from={55} durationInFrames={55}><S02_ImpactZoom /></Sequence>
      <Sequence name="03 - Split text" from={110} durationInFrames={90}><S03_SplitText /></Sequence>
      <Sequence name="04 - Wait particles" from={200} durationInFrames={85}><S05_WaitParticles /></Sequence>
      <Sequence name="05 - Venetian blind" from={285} durationInFrames={5}><VenetianBlindTransition /></Sequence>
      <Sequence name="06 - Gradient word" from={290} durationInFrames={85}><S06_GradientWord /></Sequence>
      <Sequence name="07 - Introducing stack" from={375} durationInFrames={95}><S07_IntroducingStack /></Sequence>
      <Sequence name="08 - Venetian blind" from={470} durationInFrames={5}><VenetianBlindTransition /></Sequence>
      <Sequence name="09 - Clapperboard" from={475} durationInFrames={45}><S08_Clapperboard /></Sequence>
      <Sequence name="10 - Logo splash" from={520} durationInFrames={50}><S09_LogoSplash /></Sequence>
      <Sequence name="11 - All-in-one" from={570} durationInFrames={50}><S10_AllInOne /></Sequence>
      <Sequence name="12 - To create" from={620} durationInFrames={60}><S11_ToCreate /></Sequence>
      <Sequence name="13 - View counter" from={680} durationInFrames={65}><S12_ViewCounter /></Sequence>
      <Sequence name="14 - Clock icon" from={745} durationInFrames={50}><S13_ClockIcon /></Sequence>
      <Sequence name="15 - Quickly tools" from={795} durationInFrames={60}><S14_QuicklyTools /></Sequence>
      <Sequence name="16 - Repeat scroll" from={855} durationInFrames={60}><S15_RepeatScroll /></Sequence>
      <Sequence name="17 - TikTok collage" from={915} durationInFrames={134}><S16_TikTokCollage /></Sequence>
      <Sequence name="18 - Grid click reveal" from={1049} durationInFrames={150}><S17_GridClickReveal /></Sequence>
      <Sequence name="19 - Repurpose script" from={1199} durationInFrames={55}><S18_RepurposeScript /></Sequence>
      <Sequence name="20 - Marquee bands" from={1254} durationInFrames={60}><S20_MarqueeBands /></Sequence>
      <Sequence name="21 - Stats collage" from={1314} durationInFrames={90}><S21_StatsCollage /></Sequence>
      <Sequence name="22 - Add input" from={1404} durationInFrames={55}><S22_Typewriter /></Sequence>
      <Sequence name="23 - AI toggle" from={1459} durationInFrames={60}><S24_AIToggle /></Sequence>
      <Sequence name="24 - Generate masterpiece" from={1519} durationInFrames={60}><S24c_GenerateMasterpiece /></Sequence>
      <Sequence name="25 - Video on phone" from={1579} durationInFrames={30}><S25_VideoOnPhone /></Sequence>
      <Sequence name="26 - Easy to use" from={1609} durationInFrames={30}><S26_EasyToUse /></Sequence>
      <Sequence name="27 - New video every day" from={1639} durationInFrames={90}><S28_NewVideoEveryDay /></Sequence>
      <Sequence name="28 - Auto button" from={1729} durationInFrames={90}><S30_AutoButton /></Sequence>
      <Sequence name="29 - Receive inbox" from={1819} durationInFrames={90}><S32_ReceiveInbox /></Sequence>
      <Sequence name="30 - Boost engagement" from={1909} durationInFrames={90}><S33_BoostEngagement /></Sequence>
      <Sequence name="31 - Battery turbocharge" from={1999} durationInFrames={120}><S34_BatteryTurbocharge /></Sequence>
      <Sequence name="32 - GET IT NOW" from={2119} durationInFrames={60}><S35_GetItNow /></Sequence>
      <Sequence name="33 - Split image text" from={2179} durationInFrames={75}><SNew1_SplitImageText /></Sequence>
      <Sequence name="34 - Image overlay" from={2254} durationInFrames={75}><SNew2_ImageWithOverlay /></Sequence>
      <Sequence name="35 - Framed typewriter" from={2329} durationInFrames={95}><SNew3_FramedImageTypewriter /></Sequence>
      <Sequence name="36 - Glitch transition" from={2424} durationInFrames={5}><GlitchTransition /></Sequence>
      <Sequence name="37 - Final logo" from={2429} durationInFrames={150}><S36_FinalLogo /></Sequence>
    </GlitchWrapper>
  );
};

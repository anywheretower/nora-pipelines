import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";

// Pack de Cierre genérico — 5 segundos (150 frames @ 30fps)
// Para concatenar al final de videos UGC
// Resolución: 576×1024 (9:16)

export interface PackCierreProps {
  darkBg: string;       // Color de fondo principal
  accent: string;       // Color de acento (glow, línea, barra)
  accentAlt?: string;   // Color de acento alternativo (opcional)
  logoFile: string;     // Nombre del archivo de logo en images/logos/
  logoWidth?: number;   // Ancho del logo (default 320)
  logoGap?: number;     // Gap entre elementos del grupo (default 20)
  lineOffset?: number;  // Offset vertical de la línea en px (negativo = sube)
  groupOffset?: number; // Offset vertical del grupo en % (default 50 = centro)

  urlText: string;      // URL a mostrar
  urlFontSize?: number;  // Font size del URL (default 50)
  musicFile: string;    // Nombre del archivo de música en music/
  musicVolume?: number; // Volumen (default 0.8)
}

const S01_LogoCierre: React.FC<PackCierreProps> = ({
  darkBg,
  accent,
  accentAlt,
  logoFile,
  logoWidth = 320,
  logoGap = 20,
  lineOffset = 0,
  groupOffset = 50,
  urlText,
  urlFontSize = 50,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const effectiveAccentAlt = accentAlt || accent;

  // Fade in del fondo desde negro
  const bgOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Logo spring entrance
  const logoScale = spring({
    frame: frame - 15,
    fps,
    config: { damping: 14, stiffness: 100, mass: 1 },
    from: 0.5,
    to: 1,
  });

  const logoOpacity = interpolate(frame, [15, 30], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Línea decorativa debajo del logo
  const lineWidth = interpolate(frame, [35, 55], [0, 200], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // URL spring entrance
  const urlScale = spring({
    frame: frame - 50,
    fps,
    config: { damping: 16, stiffness: 80, mass: 1 },
    from: 0.7,
    to: 1,
  });

  const urlOpacity = interpolate(frame, [50, 65], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Subtle pulse on accent
  const accentPulse = 1 + Math.sin(frame * 0.08) * 0.15;

  // Glow behind logo
  const glowOpacity = interpolate(frame, [20, 45], [0, 0.3], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {/* Dark BG with fade in */}
      <AbsoluteFill
        style={{
          backgroundColor: darkBg,
          opacity: bgOpacity,
        }}
      />

      {/* Subtle radial glow behind logo */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent}40 0%, transparent 70%)`,
          opacity: glowOpacity * accentPulse,
          filter: "blur(40px)",
        }}
      />

      {/* Centered group: Logo + Line + URL */}
      <div
        style={{
          position: "absolute",
          top: `${groupOffset}%`,
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: logoGap,
        }}
      >
        {/* Logo */}
        <div
          style={{
            transform: `scale(${logoScale})`,
            opacity: logoOpacity,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Img
            src={staticFile(`images/logos/${logoFile}`)}
            style={{
              width: logoWidth,
              objectFit: "contain",
            }}
          />
        </div>

        {/* Decorative line */}
        <div
          style={{
            width: lineWidth,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
            marginTop: lineOffset,
          }}
        />

        {/* URL */}
        <div
          style={{
            transform: `scale(${urlScale})`,
            opacity: urlOpacity,
            fontFamily: "Montserrat, sans-serif",
            fontSize: urlFontSize,
            fontWeight: 500,
            color: "#FFFFFF",
            letterSpacing: 3,
            textAlign: "center",
          }}
        >
          {urlText}
        </div>
      </div>

      {/* Bottom accent bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: 4,
          background: `linear-gradient(90deg, ${effectiveAccentAlt}, ${accent}, ${effectiveAccentAlt})`,
          opacity: interpolate(frame, [60, 75], [0, 0.8], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          }),
        }}
      />
    </AbsoluteFill>
  );
};

export const PackCierre: React.FC<PackCierreProps> = (props) => {
  return (
    <>
      <Audio
        src={staticFile(`music/${props.musicFile}`)}
        volume={props.musicVolume ?? 0.8}
      />
      <Sequence from={0} durationInFrames={150}>
        <S01_LogoCierre {...props} />
      </Sequence>
    </>
  );
};

import React, { useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import { fonts } from '../theme';

export const GlitchText: React.FC<{
  text: string;
  fontSize?: number;
  color?: string;
  intensity?: number;
  durationFrames?: number;
}> = ({ text, fontSize = 120, color = '#FFFFFF', intensity = 8, durationFrames = 10 }) => {
  const frame = useCurrentFrame();

  const offsets = useMemo(() => {
    return Array.from({ length: durationFrames }, () => ({
      x: (Math.random() - 0.5) * intensity * 2,
      y: (Math.random() - 0.5) * intensity * 2,
    }));
  }, [intensity, durationFrames]);

  const idx = frame % durationFrames;
  const offset = frame < durationFrames ? offsets[idx] : { x: 0, y: 0 };

  return (
    <div
      style={{
        fontFamily: fonts.main,
        fontWeight: 800,
        fontSize,
        color,
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        textAlign: 'center',
      }}
    >
      {text}
    </div>
  );
};

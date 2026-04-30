import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

export const RippleEffect: React.FC<{
  color?: string;
  startFrame?: number;
  x?: string;
  y?: string;
}> = ({ color = '#5ED4A4', startFrame = 0, x = '50%', y = '50%' }) => {
  const frame = useCurrentFrame();
  const f = frame - startFrame;
  if (f < 0) return null;

  const rings = [0, 5, 10];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {rings.map((delay, i) => {
        const rf = f - delay;
        if (rf < 0) return null;
        const scale = interpolate(rf, [0, 30], [0, 4], { extrapolateRight: 'clamp' });
        const opacity = interpolate(rf, [0, 10, 30], [0.6, 0.4, 0], { extrapolateRight: 'clamp' });
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: 60,
              height: 60,
              marginLeft: -30,
              marginTop: -30,
              borderRadius: '50%',
              border: `3px solid ${color}`,
              transform: `scale(${scale})`,
              opacity,
            }}
          />
        );
      })}
    </div>
  );
};

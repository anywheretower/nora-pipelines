import React, { useMemo } from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

export const Particles: React.FC<{
  count?: number;
  colors?: string[];
  maxSize?: number;
}> = ({ count = 30, colors, maxSize = 20 }) => {
  const frame = useCurrentFrame();
  const defaultColors = ['#5ED4A4', '#7868E6', '#5ED4A4', '#7868E6', '#5ED4A4'];
  const palette = colors || defaultColors;

  const dots = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 3 + Math.random() * (maxSize - 3),
      color: palette[i % palette.length],
      delay: Math.random() * 10,
    }));
  }, [count, maxSize, palette]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {dots.map((dot, i) => {
        const opacity = interpolate(
          frame - dot.delay,
          [0, 8],
          [0, 0.8],
          { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
        );
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${dot.x}%`,
              top: `${dot.y}%`,
              width: dot.size,
              height: dot.size,
              borderRadius: '50%',
              backgroundColor: dot.color,
              opacity,
            }}
          />
        );
      })}
    </div>
  );
};

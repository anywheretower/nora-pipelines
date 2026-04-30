import React, { useMemo } from 'react';
import { useCurrentFrame } from 'remotion';

export const PulsingCircles: React.FC<{
  count?: number;
  color?: string;
}> = ({ count = 15, color = '#5ED4A4' }) => {
  const frame = useCurrentFrame();

  const circles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 10 + Math.random() * 30,
      phase: Math.random() * Math.PI * 2,
      speed: 0.08 + Math.random() * 0.12,
    }));
  }, [count]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {circles.map((c, i) => {
        const scale = 0.7 + Math.sin(frame * c.speed + c.phase) * 0.4;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${c.x}%`,
              top: `${c.y}%`,
              width: c.size,
              height: c.size,
              borderRadius: '50%',
              backgroundColor: color,
              opacity: 0.5,
              transform: `scale(${scale})`,
            }}
          />
        );
      })}
    </div>
  );
};

import React from 'react';
import { useCurrentFrame } from 'remotion';

export const MovingBars: React.FC<{
  barWidth?: number;
  speed?: number;
}> = ({ barWidth = 60, speed = 3 }) => {
  const frame = useCurrentFrame();
  const offset = (frame * speed) % (barWidth * 2);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {Array.from({ length: 40 }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: i * barWidth * 2 - barWidth + offset,
            top: 0,
            width: barWidth,
            height: '100%',
            backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#000000',
            opacity: 0.15,
          }}
        />
      ))}
    </div>
  );
};

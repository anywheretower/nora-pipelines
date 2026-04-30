import React from 'react';
import { useCurrentFrame } from 'remotion';
import { fonts } from '../theme';

export const TypingCursor: React.FC<{
  text: string;
  fontSize?: number;
  color?: string;
  typingSpeed?: number; // frames per character
}> = ({ text, fontSize = 48, color = '#FFFFFF', typingSpeed = 2 }) => {
  const frame = useCurrentFrame();
  const charsVisible = Math.min(Math.floor(frame / typingSpeed), text.length);
  const showCursor = Math.floor(frame / 15) % 2 === 0;

  return (
    <span
      style={{
        fontFamily: fonts.main,
        fontWeight: 600,
        fontSize,
        color,
      }}
    >
      {text.slice(0, charsVisible)}
      <span style={{ opacity: showCursor ? 1 : 0 }}>|</span>
    </span>
  );
};

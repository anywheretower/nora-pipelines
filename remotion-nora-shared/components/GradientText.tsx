import React from 'react';
import { theme, fonts } from '../theme';

export const GradientText: React.FC<{
  text: string;
  fontSize?: number;
  gradientStart?: string;
  gradientEnd?: string;
  style?: React.CSSProperties;
}> = ({ text, fontSize = 90, gradientStart, gradientEnd, style }) => {
  return (
    <div
      style={{
        fontSize,
        fontWeight: 700,
        fontFamily: fonts.main,
        background: `linear-gradient(to right, ${gradientStart || theme.gradientStart}, ${gradientEnd || theme.gradientEnd})`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        textAlign: 'center',
        ...style,
      }}
    >
      {text}
    </div>
  );
};

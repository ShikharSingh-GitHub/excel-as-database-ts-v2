import React from 'react';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  disabled?: boolean;
}

export default function Tooltip({ 
  content, 
  children, 
  placement = 'top', 
  delay = 300,
  disabled = false 
}: TooltipProps) {
  if (disabled || !content) {
    return children;
  }

  return (
    <Tippy 
      content={content}
      placement={placement}
      delay={delay}
      arrow={true}
      theme="dark"
      animation="fade"
    >
      {children}
    </Tippy>
  );
}

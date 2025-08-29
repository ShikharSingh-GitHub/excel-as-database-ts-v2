import Tippy from "@tippyjs/react";
import React from "react";

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  placement?: "top" | "bottom" | "left" | "right";
  delay?: number;
  disabled?: boolean;
}

export default function Tooltip({
  content,
  children,
  placement = "top",
  delay = 300,
  disabled = false,
}: TooltipProps) {
  if (disabled || !content) {
    return children;
  }

  const theme =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";

  return (
    <Tippy
      content={content}
      placement={placement}
      delay={delay}
      arrow={true}
      theme={theme}
      animation="fade">
      {children}
    </Tippy>
  );
}

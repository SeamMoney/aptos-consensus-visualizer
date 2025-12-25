"use client";

import { useState, useRef, useEffect, ReactNode } from "react";

interface TooltipProps {
  children: ReactNode;
  eli5: string;
  technical?: string;
  link?: string;
  variant?: "underline" | "icon";
}

export function Tooltip({ children, eli5, technical, link, variant = "underline" }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<{ vertical: "top" | "bottom"; horizontal: "left" | "center" | "right" }>({
    vertical: "top",
    horizontal: "center",
  });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 150);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  // Adjust position to stay within viewport
  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 16;

      // Vertical positioning
      const spaceAbove = triggerRect.top;
      const spaceBelow = viewportHeight - triggerRect.bottom;
      const tooltipHeight = tooltipRect.height;

      let vertical: "top" | "bottom" = "top";
      if (spaceAbove < tooltipHeight + padding && spaceBelow > spaceAbove) {
        vertical = "bottom";
      }

      // Horizontal positioning
      const triggerCenter = triggerRect.left + triggerRect.width / 2;
      const halfTooltipWidth = tooltipRect.width / 2;

      let horizontal: "left" | "center" | "right" = "center";
      if (triggerCenter - halfTooltipWidth < padding) {
        horizontal = "left";
      } else if (triggerCenter + halfTooltipWidth > viewportWidth - padding) {
        horizontal = "right";
      }

      setPosition({ vertical, horizontal });
    }
  }, [isVisible]);

  // Handle touch events for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsVisible(!isVisible);
  };

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        tooltipRef.current &&
        triggerRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsVisible(false);
      }
    };

    if (isVisible) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isVisible]);

  const getPositionClasses = () => {
    const classes = ["tooltip-content"];
    classes.push(`tooltip-${position.vertical}`);
    classes.push(`tooltip-${position.horizontal}`);
    return classes.join(" ");
  };

  return (
    <span className="tooltip-wrapper">
      <span
        ref={triggerRef}
        className={variant === "underline" ? "term-tooltip" : "info-icon-trigger"}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onTouchStart={handleTouchStart}
        role="button"
        tabIndex={0}
        aria-describedby={isVisible ? "tooltip-content" : undefined}
      >
        {children}
      </span>

      {isVisible && (
        <div
          ref={tooltipRef}
          id="tooltip-content"
          className={getPositionClasses()}
          role="tooltip"
        >
          {/* ELI5 explanation - always shown, emphasized */}
          <p className="tooltip-eli5">{eli5}</p>

          {/* Technical details - shown in smaller text */}
          {technical && (
            <p className="tooltip-technical">{technical}</p>
          )}

          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="tooltip-link"
              onClick={(e) => e.stopPropagation()}
            >
              📚 Read the docs →
            </a>
          )}
        </div>
      )}
    </span>
  );
}

// Info icon component for standalone explanations
interface InfoIconProps {
  eli5: string;
  technical?: string;
  link?: string;
}

export function InfoIcon({ eli5, technical, link }: InfoIconProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<{ vertical: "top" | "bottom"; horizontal: "left" | "center" | "right" }>({
    vertical: "top",
    horizontal: "center",
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 150);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 16;

      const spaceAbove = triggerRect.top;
      const spaceBelow = viewportHeight - triggerRect.bottom;
      const tooltipHeight = tooltipRect.height;

      let vertical: "top" | "bottom" = "top";
      if (spaceAbove < tooltipHeight + padding && spaceBelow > spaceAbove) {
        vertical = "bottom";
      }

      const triggerCenter = triggerRect.left + triggerRect.width / 2;
      const halfTooltipWidth = tooltipRect.width / 2;

      let horizontal: "left" | "center" | "right" = "center";
      if (triggerCenter - halfTooltipWidth < padding) {
        horizontal = "left";
      } else if (triggerCenter + halfTooltipWidth > viewportWidth - padding) {
        horizontal = "right";
      }

      setPosition({ vertical, horizontal });
    }
  }, [isVisible]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        tooltipRef.current &&
        triggerRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsVisible(false);
      }
    };

    if (isVisible) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isVisible]);

  const getPositionClasses = () => {
    const classes = ["tooltip-content"];
    classes.push(`tooltip-${position.vertical}`);
    classes.push(`tooltip-${position.horizontal}`);
    return classes.join(" ");
  };

  return (
    <span className="info-icon-wrapper">
      <button
        ref={triggerRef}
        className="info-icon-button"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onClick={() => setIsVisible(!isVisible)}
        aria-label="More information"
        aria-describedby={isVisible ? "info-tooltip-content" : undefined}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 6V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="7" cy="4" r="0.75" fill="currentColor" />
        </svg>
      </button>

      {isVisible && (
        <div
          ref={tooltipRef}
          id="info-tooltip-content"
          className={getPositionClasses()}
          role="tooltip"
        >
          <p className="tooltip-eli5">{eli5}</p>
          {technical && <p className="tooltip-technical">{technical}</p>}
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="tooltip-link"
              onClick={(e) => e.stopPropagation()}
            >
              📚 Read the docs →
            </a>
          )}
        </div>
      )}
    </span>
  );
}

// External link component - MORE VISIBLE with text label
interface LearnMoreLinkProps {
  href: string;
  label?: string;
}

export function LearnMoreLink({ href, label = "Docs" }: LearnMoreLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="learn-more-link"
      title={`Open ${label}`}
    >
      <span className="learn-more-text">{label}</span>
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3.5 8.5L8.5 3.5M8.5 3.5H4.5M8.5 3.5V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

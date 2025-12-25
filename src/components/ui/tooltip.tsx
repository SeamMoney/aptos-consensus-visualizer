"use client";

import { useState, useRef, useEffect, ReactNode } from "react";

interface TooltipProps {
  children: ReactNode;
  content: string;
  link?: string;
  variant?: "underline" | "icon";
}

export function Tooltip({ children, content, link, variant = "underline" }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<"top" | "bottom">("top");
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 200); // 200ms delay to prevent accidental triggers
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  // Adjust position if tooltip would go off-screen
  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const tooltipHeight = 100; // Estimated height

      if (spaceAbove < tooltipHeight) {
        setPosition("bottom");
      } else {
        setPosition("top");
      }
    }
  }, [isVisible]);

  // Handle touch events for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsVisible(!isVisible);
  };

  // Close tooltip when clicking outside on mobile
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
        {variant === "icon" && <span className="info-icon">i</span>}
      </span>

      {isVisible && (
        <div
          ref={tooltipRef}
          id="tooltip-content"
          className={`tooltip-content tooltip-${position}`}
          role="tooltip"
        >
          <p>{content}</p>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="tooltip-link"
              onClick={(e) => e.stopPropagation()}
            >
              Learn more
            </a>
          )}
        </div>
      )}
    </span>
  );
}

// Simple info icon component for section headers
interface InfoIconProps {
  content: string;
  link?: string;
}

export function InfoIcon({ content, link }: InfoIconProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<"top" | "bottom">("top");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 200);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const tooltipHeight = 100;

      if (spaceAbove < tooltipHeight) {
        setPosition("bottom");
      } else {
        setPosition("top");
      }
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
          className={`tooltip-content tooltip-${position}`}
          role="tooltip"
        >
          <p>{content}</p>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="tooltip-link"
              onClick={(e) => e.stopPropagation()}
            >
              Learn more
            </a>
          )}
        </div>
      )}
    </span>
  );
}

// External link component for section headers
interface LearnMoreLinkProps {
  href: string;
  label?: string;
}

export function LearnMoreLink({ href, label = "Documentation" }: LearnMoreLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="learn-more-link"
      aria-label={label}
      title={label}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3.5 8.5L8.5 3.5M8.5 3.5H4.5M8.5 3.5V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

"use client";

import { memo, ReactNode } from "react";
import { useVisibility } from "@/hooks/useVisibility";
import { usePixi } from "@/hooks/usePixi";
import { PIXI_COLORS } from "@/lib/pixi-utils";

interface PixiCanvasProps {
  title: string;
  height?: number | string;
  showLiveBadge?: boolean;
  backgroundColor?: number;
  children?: (props: {
    app: ReturnType<typeof usePixi>["app"];
    isVisible: boolean;
    isReady: boolean;
  }) => ReactNode;
  controls?: ReactNode;
  stats?: ReactNode;
  footer?: ReactNode;
}

/**
 * Base wrapper component for PixiJS visualizations
 * Provides consistent styling, visibility management, and layout
 */
export const PixiCanvas = memo(function PixiCanvas({
  title,
  height = 300,
  showLiveBadge = false,
  backgroundColor = PIXI_COLORS.background,
  children,
  controls,
  stats,
  footer,
}: PixiCanvasProps) {
  const { containerRef, app, isReady } = usePixi(true, { backgroundColor });
  const isVisible = useVisibility(containerRef);

  return (
    <div className="chrome-card p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title">{title}</h3>
        <div className="flex items-center gap-3">
          {controls}
          {showLiveBadge && (
            <div className="live-badge">
              <span className="live-dot" />
              Live
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      {stats && <div className="mb-4">{stats}</div>}

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="canvas-wrap relative"
        style={{
          height: typeof height === "number" ? `${height}px` : height,
          backgroundColor: `#${backgroundColor.toString(16).padStart(6, "0")}`,
        }}
      >
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-sm" style={{ color: "var(--chrome-500)" }}>
              Loading...
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {footer && <div className="mt-3">{footer}</div>}

      {/* Render children with app context */}
      {children && isReady && children({ app, isVisible, isReady })}
    </div>
  );
});

"use client";

import { useEffect, useRef, useState, RefObject } from "react";
import { Application } from "pixi.js";
import { DEFAULT_PIXI_CONFIG, TARGET_FPS, FRAME_TIME } from "@/lib/pixi-utils";

interface UsePixiOptions {
  backgroundColor?: number;
  antialias?: boolean;
}

interface UsePixiReturn {
  app: Application | null;
  containerRef: RefObject<HTMLDivElement | null>;
  isReady: boolean;
}

/**
 * Hook for managing PixiJS Application lifecycle in React
 * - Creates/destroys Application on mount/unmount
 * - Handles resize with devicePixelRatio
 * - Integrates with visibility for performance
 * - Throttles to TARGET_FPS (30 FPS)
 */
export function usePixi(
  isVisible: boolean,
  options: UsePixiOptions = {}
): UsePixiReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const [isReady, setIsReady] = useState(false);
  const lastFrameTimeRef = useRef<number>(0);

  const { backgroundColor = DEFAULT_PIXI_CONFIG.backgroundColor, antialias = DEFAULT_PIXI_CONFIG.antialias } =
    options;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let mounted = true;
    let resizeObserver: ResizeObserver | null = null;

    const initPixi = async () => {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const app = new Application();

      await app.init({
        width: rect.width,
        height: rect.height,
        backgroundColor,
        antialias,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (!mounted) {
        app.destroy(true, { children: true });
        return;
      }

      // Add canvas to container
      container.appendChild(app.canvas as HTMLCanvasElement);
      appRef.current = app;

      // Throttle ticker to target FPS
      app.ticker.add(() => {
        const now = performance.now();
        if (now - lastFrameTimeRef.current < FRAME_TIME) {
          return;
        }
        lastFrameTimeRef.current = now;
      });

      // Handle resize
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0 && appRef.current) {
            appRef.current.renderer.resize(width, height);
          }
        }
      });
      resizeObserver.observe(container);

      setIsReady(true);
    };

    initPixi();

    return () => {
      mounted = false;
      resizeObserver?.disconnect();

      if (appRef.current) {
        const canvas = appRef.current.canvas as HTMLCanvasElement;
        appRef.current.destroy(true, { children: true });
        if (canvas && container.contains(canvas)) {
          container.removeChild(canvas);
        }
        appRef.current = null;
      }
      setIsReady(false);
    };
  }, [backgroundColor, antialias]);

  // Pause/resume based on visibility
  useEffect(() => {
    if (!appRef.current) return;

    if (isVisible) {
      appRef.current.ticker.start();
    } else {
      appRef.current.ticker.stop();
    }
  }, [isVisible]);

  return {
    app: appRef.current,
    containerRef,
    isReady,
  };
}

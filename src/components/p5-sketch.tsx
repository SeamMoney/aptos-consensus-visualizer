"use client";

import { useEffect, useRef, useCallback } from "react";
import p5 from "p5";

export type SketchFunction = (p: p5) => void;

interface P5SketchProps {
  sketch: SketchFunction;
  className?: string;
}

export function P5Sketch({ sketch, className = "" }: P5SketchProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<p5 | null>(null);

  const initSketch = useCallback(() => {
    if (!containerRef.current) return;

    // Clean up existing instance
    if (p5InstanceRef.current) {
      p5InstanceRef.current.remove();
      p5InstanceRef.current = null;
    }

    // Create new instance
    p5InstanceRef.current = new p5(sketch, containerRef.current);
  }, [sketch]);

  useEffect(() => {
    initSketch();

    return () => {
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove();
        p5InstanceRef.current = null;
      }
    };
  }, [initSketch]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ touchAction: "none" }}
    />
  );
}

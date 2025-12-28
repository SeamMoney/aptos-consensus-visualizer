"use client";

import { useEffect, useRef, useState, memo } from "react";
import { useAptosStream, BlockStats } from "@/hooks/useAptosStream";
import { useVisibility } from "@/hooks/useVisibility";
import { useNetwork } from "@/contexts/NetworkContext";

interface GridBlock {
  blockHeight: number;
  timestamp: number;
  txCount: number;
}

// Color based on transaction count - more granular gradient
function getBlockColor(txCount: number): string {
  if (txCount === 0) return "#1e1e22";
  if (txCount === 1) return "#1a3020";
  if (txCount <= 3) return "#1a3d2a";
  if (txCount <= 5) return "#1a4530";
  if (txCount <= 10) return "#1a4d3a";
  if (txCount <= 20) return "#00704a";
  if (txCount <= 30) return "#00875a";
  if (txCount <= 50) return "#00a86b";
  if (txCount <= 80) return "#00c77b";
  if (txCount <= 120) return "#00d98a";
  return "#00f5a0"; // Bright for 120+ tx
}

// Get text color that contrasts with block color
function getTextColor(txCount: number): string {
  if (txCount <= 10) return "rgba(255, 255, 255, 0.5)";
  return "rgba(0, 0, 0, 0.7)";
}

export const BlockStream = memo(function BlockStream() {
  const { stats, connected } = useAptosStream();
  const { network } = useNetwork();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridRef = useRef<GridBlock[][]>([]);
  const animationRef = useRef<number>(0);
  const lastBlockHeightRef = useRef<number>(0);
  const gridIndexRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const [hoveredBlock, setHoveredBlock] = useState<GridBlock | null>(null);
  const [gridDimensions, setGridDimensions] = useState({ cols: 50, rows: 8 });
  const isVisible = useVisibility(containerRef);
  const prevNetworkRef = useRef(network);

  // Clear grid when network changes
  useEffect(() => {
    if (prevNetworkRef.current !== network) {
      prevNetworkRef.current = network;
      const { cols, rows } = gridDimensions;
      // Reset all refs
      lastBlockHeightRef.current = 0;
      gridIndexRef.current = 0;
      // Clear the grid with empty blocks
      const emptyGrid: GridBlock[][] = [];
      for (let r = 0; r < rows; r++) {
        emptyGrid[r] = [];
        for (let c = 0; c < cols; c++) {
          emptyGrid[r][c] = { blockHeight: 0, timestamp: 0, txCount: 0 };
        }
      }
      gridRef.current = emptyGrid;
    }
  }, [network, gridDimensions]);

  // Initialize grid with current dimensions
  useEffect(() => {
    const { cols, rows } = gridDimensions;
    // Preserve existing data when resizing
    const newGrid: GridBlock[][] = [];
    for (let r = 0; r < rows; r++) {
      newGrid[r] = [];
      for (let c = 0; c < cols; c++) {
        // Try to preserve existing block data
        newGrid[r][c] = gridRef.current[r]?.[c] || { blockHeight: 0, timestamp: 0, txCount: 0 };
      }
    }
    gridRef.current = newGrid;
  }, [gridDimensions]);

  // Handle new blocks from stream
  useEffect(() => {
    if (stats.recentBlocks.length === 0) return;

    const { cols, rows } = gridDimensions;

    // Find new blocks we haven't processed yet
    const newBlocks = stats.recentBlocks.filter(
      (b) => b.blockHeight > lastBlockHeightRef.current
    );

    if (newBlocks.length === 0) return;

    // Update last seen block height
    lastBlockHeightRef.current = Math.max(...newBlocks.map((b) => b.blockHeight));

    // Add new blocks to grid (oldest first)
    const sortedBlocks = [...newBlocks].sort((a, b) => a.blockHeight - b.blockHeight);

    for (const block of sortedBlocks) {
      const row = gridIndexRef.current % rows;
      const col = Math.floor(gridIndexRef.current / rows) % cols;

      if (gridRef.current[row]) {
        gridRef.current[row][col] = {
          blockHeight: block.blockHeight,
          timestamp: Date.now(),
          txCount: block.txCount,
        };
      }

      gridIndexRef.current = (gridIndexRef.current + 1) % (rows * cols);
    }
  }, [stats.recentBlocks, gridDimensions]);

  // Canvas rendering
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.cursor = "crosshair";
    container.appendChild(canvas);
    canvasRef.current = canvas;

    // Mouse tracking for hover
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };
    canvas.addEventListener("mousemove", handleMouseMove);

    let lastResize = 0;
    let lastFrame = 0;
    const targetFPS = 24;
    const frameInterval = 1000 / targetFPS;

    const draw = (timestamp: number) => {
      if (!canvas || !container) return;

      // Skip rendering when off-screen
      if (!isVisible) {
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      if (timestamp - lastFrame < frameInterval) {
        animationRef.current = requestAnimationFrame(draw);
        return;
      }
      lastFrame = timestamp;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const now = Date.now();
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      if (now - lastResize > 200) {
        if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
          canvas.width = Math.floor(width * dpr);
          canvas.height = Math.floor(height * dpr);
          canvas.style.width = width + "px";
          canvas.style.height = height + "px";
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          lastResize = now;
        }
      }

      // Clear
      ctx.fillStyle = "#141416";
      ctx.fillRect(0, 0, width, height);

      const gap = 1;

      // Fixed 8 rows - this determines our cell height
      const targetRows = 8;
      const cellH = height / targetRows;

      // Calculate columns to make cells as square as possible while filling width
      // Use cellH as the target size, calculate how many columns fit
      const cols = Math.max(10, Math.ceil(width / cellH));

      // Update grid dimensions if changed (for data storage)
      if (cols !== gridDimensions.cols || targetRows !== gridDimensions.rows) {
        setGridDimensions({ cols, rows: targetRows });
      }

      // IMPORTANT: Use calculated values directly, not state (avoids timing issues)
      const currentCols = cols;
      const currentRows = targetRows;

      // Calculate actual cell dimensions to FILL the entire canvas
      // Cells will be nearly square (slightly wider to fill width exactly)
      const actualCellW = width / currentCols;
      const actualCellH = height / currentRows;

      // Find hovered cell
      const hoveredCol = Math.floor(mouseRef.current.x / actualCellW);
      const hoveredRow = Math.floor(mouseRef.current.y / actualCellH);
      let currentHovered: GridBlock | null = null;

      // Draw blocks - fill entire canvas
      for (let r = 0; r < currentRows; r++) {
        for (let c = 0; c < currentCols; c++) {
          const block = gridRef.current[r]?.[c];

          const x = c * actualCellW + gap;
          const y = r * actualCellH + gap;
          const w = actualCellW - gap * 2;
          const h = actualCellH - gap * 2;

          if (!block || block.timestamp === 0) {
            ctx.fillStyle = "#1a1a1d";
            ctx.fillRect(x, y, w, h);
            continue;
          }

          const isHovered = r === hoveredRow && c === hoveredCol &&
                           hoveredCol >= 0 && hoveredCol < currentCols &&
                           hoveredRow >= 0 && hoveredRow < currentRows;
          if (isHovered) currentHovered = block;

          // Block color based on tx count
          ctx.fillStyle = getBlockColor(block.txCount);
          ctx.fillRect(x, y, w, h);

          // Show tx count inside block - adaptive font size
          if (block.txCount > 0) {
            ctx.fillStyle = getTextColor(block.txCount);
            const fontSize = Math.max(6, Math.min(10, Math.min(w, h) - 4));
            ctx.font = `bold ${fontSize}px monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(block.txCount), x + w / 2, y + h / 2);
          }

          // Highlight new blocks (< 2 seconds)
          const age = (now - block.timestamp) / 1000;
          if (age < 2) {
            const pulse = age < 0.5 ? 1 : 1 - (age - 0.5) / 1.5;
            ctx.strokeStyle = `rgba(0, 217, 165, ${pulse * 0.8})`;
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, w, h);

            if (age < 0.5) {
              ctx.shadowBlur = 8;
              ctx.shadowColor = "#00d9a5";
              ctx.strokeRect(x, y, w, h);
              ctx.shadowBlur = 0;
            }
          }

          // Hover highlight
          if (isHovered) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, w, h);
          }
        }
      }

      setHoveredBlock(currentHovered);
      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationRef.current);
      canvas.removeEventListener("mousemove", handleMouseMove);
      if (canvasRef.current && container.contains(canvasRef.current)) {
        container.removeChild(canvasRef.current);
      }
    };
  }, [isVisible]);

  return (
    <div className="chrome-card p-4 sm:p-5 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="section-title">Block River</h3>
          <div className={`live-badge ${!connected ? 'opacity-50' : ''}`}>
            <span className="live-dot" />
            {connected ? 'Live' : 'Connecting...'}
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm tabular-nums">
          <span style={{ color: "var(--chrome-500)" }}>
            TPS <span className="stat-value-accent">{stats.tps.toLocaleString()}</span>
          </span>
          <span style={{ color: "var(--chrome-500)" }}>
            Block <span style={{ color: "var(--chrome-200)" }}>{stats.blockHeight.toLocaleString()}</span>
          </span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="canvas-wrap"
        style={{ height: "160px" }}
      />

      {/* Hover tooltip */}
      {hoveredBlock && hoveredBlock.blockHeight > 0 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-black/95 border border-white/20 rounded-lg px-3 py-2 text-xs z-10 pointer-events-none">
          <div className="text-emerald-400 font-mono font-bold">
            Block #{hoveredBlock.blockHeight.toLocaleString()}
          </div>
          <div className="text-white/80 mt-1">
            <span className="text-emerald-400 font-bold">{hoveredBlock.txCount}</span> transactions
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-3 gap-2 text-xs" style={{ color: "var(--chrome-500)" }}>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#1a4d3a" }} />
            1-10 tx
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#00875a" }} />
            10-30 tx
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#00c77b" }} />
            30-80 tx
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#00f5a0" }} />
            80+ tx
          </span>
        </div>
        <span style={{ color: "var(--chrome-600)" }}>
          ~{stats.avgBlockTime || 94}ms blocks
        </span>
      </div>
    </div>
  );
});

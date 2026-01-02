# CLAUDE.md

This document provides comprehensive guidance for AI assistants working on the Aptos Consensus Visualizer codebase.

## Project Overview

**Aptos Consensus Visualizer** (aka Aptos Velociraptr) is an interactive educational web application that explains how the Aptos blockchain achieves 160,000+ TPS through animated visualizations of:

- Block-STM parallel execution
- Raptr 4-hop BFT consensus
- Quorum Store data availability
- Move VM execution pipeline
- Various optimizations (Velociraptr, Archon, Shardines, Zaptos)

**Live Site:** https://aptos-consensus-visualizer.vercel.app

## Technology Stack

| Category | Technologies |
|----------|-------------|
| **Framework** | Next.js 15.1 (App Router), React 19, TypeScript 5 |
| **Visualization** | PixiJS 8.14 (WebGL), p5.js 2.1, HTML5 Canvas 2D |
| **Styling** | Tailwind CSS 3.4, CSS Custom Properties |
| **UI Components** | Radix UI (tabs, slot), Lucide React (icons) |
| **Animation** | Framer Motion 12, requestAnimationFrame |
| **Build** | PostCSS, ESLint 9, TypeScript strict mode |

## Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── aptos/         # Aptos blockchain proxy routes
│   │   │   ├── block/     # GET /api/aptos/block
│   │   │   ├── ledger/    # GET /api/aptos/ledger
│   │   │   ├── validators/# GET /api/aptos/validators
│   │   │   └── _utils.ts  # Rate limiting, RPC failover
│   │   └── blocks/stream/ # WebSocket streaming
│   ├── layout.tsx         # Root layout, SEO metadata
│   ├── page.tsx           # Main dashboard (~312 lines)
│   ├── providers.tsx      # Context providers wrapper
│   ├── globals.css        # Design tokens, component classes
│   └── opengraph-image.tsx# Dynamic OG image generation
│
├── components/             # React components (40+)
│   ├── pixi/              # PixiJS WebGL visualizations
│   │   ├── pixi-canvas.tsx# Base Pixi wrapper
│   │   ├── encrypted-mempool.tsx
│   │   ├── orderbook-stress.tsx
│   │   └── index.ts       # Pixi exports
│   ├── ui/                # Shared UI components
│   │   └── tooltip.tsx    # ELI5/technical tooltips
│   ├── block-stm.tsx      # Block-STM visualization
│   ├── block-stream.tsx   # Live block production
│   ├── tps-race.tsx       # Chain TPS comparison
│   ├── raptr-consensus.tsx# 4-hop consensus
│   └── [30+ more...]
│
├── hooks/                  # Custom React hooks
│   ├── useAptosStream.ts  # Live blockchain data
│   ├── usePixi.ts         # PixiJS lifecycle
│   ├── useVisibility.ts   # IntersectionObserver
│   └── useLatencyStorage.ts
│
├── contexts/              # React Context
│   └── NetworkContext.tsx # mainnet/testnet selection
│
├── lib/                   # Utilities
│   ├── aptos.ts          # Aptos API client
│   ├── pixi-utils.ts     # Pixi colors, easing, formatting
│   └── utils.ts          # cn() class merge utility
│
└── data/                  # Static data
    └── glossary.ts       # Terms with ELI5 explanations

public/                    # Static assets
scripts/                   # Video/narrative copy (not code)
```

## Development Commands

```bash
npm install      # Install dependencies
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run start    # Serve production build
npm run lint     # Run ESLint
```

**Note:** No test suite is currently configured. If adding tests, place them in `src/**/__tests__/` and update package.json.

## Code Conventions

### File Naming
- **Components:** PascalCase (`BlockSTM.tsx`, `ConsensusObserver.tsx`)
- **Hooks:** camelCase with `use` prefix (`useAptosStream.ts`)
- **Utilities:** camelCase (`pixi-utils.ts`)

### TypeScript
- Strict mode enabled
- Use interfaces for props and data types
- Path alias: `@/*` maps to `./src/*`

### Component Pattern
```typescript
"use client";

import { useRef, useEffect, useState, memo } from "react";
import { useVisibility } from "@/hooks/useVisibility";

interface ComponentProps {
  data?: SomeData;
}

export const ComponentName = memo(function ComponentName(props: ComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const isVisible = useVisibility(containerRef);

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (!isVisible) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      // Animation logic...
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [isVisible]);

  return (
    <div ref={containerRef} className="chrome-card p-4">
      <canvas ref={canvasRef} className="w-full" />
    </div>
  );
});
```

### Key Patterns
1. **`"use client"`** - Required for components with hooks
2. **`memo()`** - Wrap expensive visualization components
3. **`useVisibility()`** - Pause off-screen animations
4. **30 FPS throttling** - Use `timestamp - lastTime < 33.3` check
5. **DPI scaling** - Use `devicePixelRatio` for crisp canvas rendering

## Styling Approach

### CSS Custom Properties (globals.css)
```css
--accent: #00D9A5              /* Aptos green */
--chrome-100 to --chrome-950   /* Grayscale palette */
--bg-base, --bg-elevated       /* Background layers */
--border-subtle, --border-default
```

### Component Classes
- `.chrome-card` - Main container with elevated surface
- `.chrome-surface` - Inner elevated areas
- `.stat-value` - Large metric display (mono font)
- `.stat-label` - Small uppercase labels
- `.live-badge` - Pulsing live indicator
- `.canvas-wrap` - Canvas container

### Tailwind Customization (tailwind.config.ts)
```typescript
colors: {
  aptos: {
    teal: "#06D6A0",
    dark: "#1A1A2E",
    light: "#F8F9FA",
    accent: "#4ECDC4"
  }
}
```

## Animation Guidelines

### Canvas 2D Pattern
```typescript
const render = (timestamp: number) => {
  // FPS throttling (30 FPS)
  if (timestamp - lastTime < 33.3) {
    animationRef.current = requestAnimationFrame(render);
    return;
  }
  lastTime = timestamp;

  // DPI scaling
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (canvas.width !== Math.floor(rect.width * dpr)) {
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.scale(dpr, dpr);
  }

  ctx.clearRect(0, 0, width, height);
  // Drawing code...

  animationRef.current = requestAnimationFrame(render);
};
```

### PixiJS Pattern
- Use `usePixi()` hook for Application lifecycle
- Color palette in `lib/pixi-utils.ts`
- Target 30 FPS via ticker throttling
- Use `PixiCanvas` wrapper for consistent styling

## Performance Considerations

1. **Visibility-based rendering** - All animations pause when off-screen
2. **Component memoization** - Heavy components wrapped with `memo()`
3. **FPS throttling** - 30 FPS target (33.3ms frame interval)
4. **Canvas DPI scaling** - Responsive to devicePixelRatio
5. **Lazy state init** - Cache baseline data in localStorage

## API Routes

### Aptos Proxy Routes (`src/app/api/aptos/`)

**Purpose:** Rate limiting, RPC failover, CORS handling

| Endpoint | Description |
|----------|-------------|
| `GET /api/aptos/block?network=X&height=N` | Fetch block by height |
| `GET /api/aptos/ledger?network=X` | Get ledger info |
| `GET /api/aptos/validators?network=X` | Get validator set |

### Environment Variables
```bash
# WebSocket endpoints
NEXT_PUBLIC_APTOS_WS_MAINNET=wss://...
NEXT_PUBLIC_APTOS_WS_TESTNET=wss://...

# RPC endpoints (with failover)
APTOS_FULLNODE_MAINNET=https://...
APTOS_QUICKNODE_MAINNET=https://...
APTOS_LABS_MAINNET=https://...

# Optional API keys
APTOS_API_KEY_MAINNET=...
APTOS_API_KEY_TESTNET=...
```

## State Management

### NetworkContext
- Provides `network` state ("mainnet" | "testnet")
- WebSocket endpoint configuration
- Environment variable support

### Key Hooks
- **`useAptosStream()`** - Live block/consensus data with smart caching
- **`usePixi()`** - PixiJS Application lifecycle
- **`useVisibility()`** - IntersectionObserver for performance
- **`useLatencyStorage()`** - Latency history with localStorage persistence

## Common Tasks

### Adding a New Visualization Component
1. Create file in `src/components/` (or `src/components/pixi/` for PixiJS)
2. Use the standard component pattern with `memo()` and `useVisibility()`
3. Import and add to `src/app/page.tsx` in the appropriate section
4. Add any new glossary terms to `src/data/glossary.ts`

### Adding a New API Route
1. Create route in `src/app/api/[endpoint]/route.ts`
2. Use `fetchFromAny()` from `_utils.ts` for Aptos RPC calls
3. Handle rate limiting with proper 429 responses

### Updating OG/Twitter Images
- Edit `src/app/opengraph-image.tsx` and `src/app/twitter-image.tsx`
- These generate dynamic images at build/request time

## Git Conventions

### Commit Messages
- Short, imperative, sentence-case
- Examples:
  - `Add network toggle`
  - `Fix PixiJS ticker cleanup errors`
  - `Update consensus visualization layout`

### Branch Naming
- Feature: `feature/description`
- Fix: `fix/description`
- Claude branches: `claude/description-sessionId`

## Important Files

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Main dashboard layout |
| `src/app/globals.css` | Design tokens, component classes |
| `src/hooks/useAptosStream.ts` | Core data fetching hook |
| `src/hooks/useVisibility.ts` | Performance optimization |
| `src/lib/pixi-utils.ts` | Pixi colors, easing, formatting |
| `src/data/glossary.ts` | Educational content definitions |
| `tailwind.config.ts` | Aptos color palette, animations |

## Troubleshooting

### PixiJS HMR Errors
- Ensure proper cleanup in `useEffect` return
- Use `mountedRef` guard pattern for async operations
- Check ticker cleanup with `app.ticker.stop()` before destroy

### Canvas Black/Blank Issues
- Verify DPI scaling is applied
- Check `isVisible` state from `useVisibility()`
- Ensure canvas dimensions are set before drawing

### Rate Limiting (429 Errors)
- API routes handle retry logic automatically
- `useAptosStream` includes exponential backoff
- Check `_utils.ts` for failover configuration

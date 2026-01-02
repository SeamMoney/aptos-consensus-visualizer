# Encrypted Mempool Visualization: Full Research + Build Brief

**Purpose:** Provide a complete technical and creative spec for building an encrypted mempool animation in the Aptos consensus visualizer.  
**Audience:** Design + engineering (LLM or human) building the front-end animation.  
**Status:** 🔵 COMING SOON (governance-pending; not yet in aptos-core).  
**Scope:** Visual storytelling + accurate technical claims + implementation outline.

---

## 1) Research Summary (All Findings)

### A) aptos-core repo (current implementation reality)
- No encrypted mempool implementation or spec in the codebase.
- Current mempool is a shared mempool, gas-price ordered, with TTL and per-account limits.
- Mempool is transparent today; validators and peers can see transaction contents before ordering.

**Primary source:**  
`aptos-core/mempool/README.md`  
https://github.com/aptos-labs/aptos-core/blob/main/mempool/README.md

**Implication for animation and copy:**  
This must be labeled **"coming soon / governance-pending"**. Do not present as live.

### B) Aptos Foundation forum announcement
- Encrypted mempool intended to keep transactions confidential before execution.
- Users send **encrypted payloads (ciphertexts)** to validators.
- Validators decrypt **batches** using **Batched Threshold Decryption**.
- Expected overhead: **< 20ms**.
- Intended to prevent front-running, order-flow leakage, censorship/MEV.
- Governance approval required.

**Primary source (JSON):**  
https://forum.aptosfoundation.org/t/aptos-introduces-built-in-mev-protection-with-encrypted-mempools/17175.json

### C) TrX research paper (IACR ePrint 2025/2032)
**Title:** TrX: Encrypted Mempools in High Performance BFT Protocols  
**Key technical claims:**
- Uses **threshold encryption** so transactions stay private until ordering completes.
- **Batched threshold decryption** reduces overhead:  
  - Communication: **O(n)** (n validators)  
  - Compute: **O~(n + B)** for batch size B  
- Improves usability: no per-block-height encryption requirement.
- Prototype overhead: **~27 ms (about 14%)** vs baseline.

**Primary source:**  
https://eprint.iacr.org/2025/2032.pdf

### D) Other references
Medium post exists but is blocked via scrape. Use only the forum + paper + aptos-core doc for citations.  
Medium link (optional for human readers):  
https://medium.com/aptoslabs/introducing-encrypted-mempool-mev-protection-native-to-aptos-e90da3cfb254

---

## 2) Truth-Safe Copy Rules

Use these rules to avoid over-claiming:
- Always say **"governance-pending"** or **"coming soon"**.
- Never say "live in aptos-core" or "already deployed."
- Use the two overhead numbers as:  
  - **Expected <20ms** (announcement)  
  - **~27ms (14%) in prototype** (paper)
- Use exact terms: **ciphertext**, **threshold encryption**, **batched threshold decryption**.

Approved claims to use in UI/voiceover:
- "Transactions are encrypted as ciphertexts before entering the mempool."
- "Validators decrypt in batches using threshold decryption."
- "Intent stays hidden until ordering is complete."
- "Expected overhead is under 20ms; TrX prototype reports ~27ms (14%)."

---

## 3) Visual Narrative (Storyboard)

**Total loop:** 8-12 seconds.  
**Goal:** Make the privacy benefit obvious while showing that throughput and latency remain fast.

### Scene 1 — Transparent mempool = MEV
**Visual:**  
- Clear-text transactions floating into a pool labeled "MEMPOOL".  
- Bots scan and reorder a transaction.  
**Motion:**  
- A bot grabs a "BUY" txn and jumps ahead.  
**Text overlay:**  
- "Transparent mempool -> MEV"
- "Front-run / sandwich / leak intent"

### Scene 2 — Client-side encryption
**Visual:**  
- Wallet icon sends a transaction into an "ENCRYPT" tunnel.  
- Packet morphs into a locked ciphertext (random glyphs + lock).  
**Text overlay:**  
- "Encrypt intent"

### Scene 3 — Encrypted shared mempool
**Visual:**  
- Mempool contains only ciphertext packets.  
- Bots attempt to scan and fail (no data icon).  
**Text overlay:**  
- "Validators see ciphertext only"

### Scene 4 — Batched threshold decryption
**Visual:**  
- Validators around a ring emit partial key beams into a single decrypt pulse.  
- Entire batch unlocks simultaneously.  
**Text overlay:**  
- "Batched threshold decryption"
- "Expected <20ms; ~27ms (14%) in prototype"

### Scene 5 — Execute + finalize
**Visual:**  
- Cleartext transactions flow into execution.  
- Block seal appears and chain height ticks.  
**Text overlay:**  
- "Order first. Reveal later."

---

## 4) Visual Style / Palette

- **Ciphertext:** neon cyan + lock icon  
- **Cleartext:** warm white  
- **MEV bots:** red/orange  
- **Validators:** Aptos teal/green  
- **Background:** dark grid with subtle vignette  
- **Typography:** match site font in CSS or use simple sans-serif in Pixi text

---

## 5) UI Copy (Short overlays)

Short overlay options (rotate per scene):
- "MEV thrives on visibility."
- "Encrypt intent, not execution."
- "Batch decrypt = minimal overhead."
- "Order first. Reveal later."

Footer (subtle):  
**"Governance-pending. Sources: Aptos Foundation + TrX paper."**

---

## 6) Data Model (for animation)

### Entities
```ts
type PacketState = "clear" | "ciphertext" | "decrypted";
type Packet = {
  id: number;
  x: number;
  y: number;
  vx: number;
  state: PacketState;
  lane: "user" | "mempool" | "execution";
};

type Bot = { x: number; y: number; active: boolean; };
type Validator = { x: number; y: number; phase: "idle" | "share" | "decrypt"; };
```

### Phases (looped)
```ts
type Phase =
  | "transparent_mempool"
  | "encrypt"
  | "encrypted_mempool"
  | "batch_decrypt"
  | "execute";
```

---

## 7) Animation Timing

Suggested durations (12s loop):
- transparent_mempool: 2.2s
- encrypt: 1.6s
- encrypted_mempool: 2.4s
- batch_decrypt: 2.2s
- execute: 2.0s
- 1.6s buffer for transitions (fade/slew)

---

## 8) Component API (frontend)

**File target:** `src/components/pixi/encrypted-mempool.tsx`

```ts
interface EncryptedMempoolProps {
  className?: string;
  loopMs?: number;       // default 12000
  packetCount?: number;  // default 60
}
```

Suggested exports in `src/components/pixi/index.ts`:
```ts
export { EncryptedMempool } from "./encrypted-mempool";
```

---

## 9) Implementation Outline (Pixi)

### Setup
- Create Pixi `Application` and layers:
  - background grid
  - packets layer
  - bots layer
  - validators ring
  - text overlays
- Use `ticker` for animation.

### State machine
```ts
const phases: Phase[] = [
  "transparent_mempool",
  "encrypt",
  "encrypted_mempool",
  "batch_decrypt",
  "execute",
];
```

Use `phaseStart = performance.now()` and transition by time.

### Visual transformations
- **encrypt phase:** packets morph to lock glyphs (swap sprite/tint).
- **encrypted mempool:** bots fade (opacity 0.3).
- **batch decrypt:** validators emit beams, packets switch state to "decrypted".
- **execute:** packets move to execution lane, block seal stamp.

---

## 10) Pseudocode (core loop)

```ts
const now = performance.now();
const elapsed = now - loopStart;
const phase = getPhase(elapsed, phaseDurations);

switch (phase) {
  case "transparent_mempool":
    showClearPackets();
    botsActive(true);
    break;
  case "encrypt":
    morphPacketsToCiphertext();
    botsActive(false);
    break;
  case "encrypted_mempool":
    holdCiphertext();
    showNoDataIcons();
    break;
  case "batch_decrypt":
    validatorsEmitKeys();
    unlockBatch();
    break;
  case "execute":
    moveDecryptedToExecution();
    showBlockSeal();
    break;
}
```

---

## 11) Technical Tooltip / Caption (use exact wording)

**Tooltip text (2-3 lines):**  
"Encrypted mempool (governance-pending) hides transaction intent as ciphertext until ordering completes. Validators then batch-decrypt using threshold shares. Expected overhead <20ms; TrX prototype reports ~27ms (~14%)."

---

## 12) Integration Location (page placement)

Suggested section: **after Quorum Store / Transaction Pipeline**, near other core protocol flows.  
Tag id: `#encrypted-mempool`

---

## 13) Checklist for accuracy

- [ ] Mark as governance-pending  
- [ ] Use "ciphertext" wording  
- [ ] Include batched threshold decryption in copy  
- [ ] Cite overhead numbers (forum + TrX)  
- [ ] Avoid "live in core" claim

---

## 14) Source Links (for display or footnote)

- Aptos Foundation forum announcement (JSON):  
  https://forum.aptosfoundation.org/t/aptos-introduces-built-in-mev-protection-with-encrypted-mempools/17175.json
- TrX paper (IACR ePrint 2025/2032):  
  https://eprint.iacr.org/2025/2032.pdf
- aptos-core mempool doc (current state):  
  https://github.com/aptos-labs/aptos-core/blob/main/mempool/README.md

# Encrypted Mempool Visualization Spec

**Purpose:** Explain how encrypted mempools prevent MEV by hiding transaction intent until batch decryption.  
**Status:** 🔵 COMING SOON (governance‑pending).  
**Primary Sources:**  
- Aptos Foundation forum announcement (JSON): https://forum.aptosfoundation.org/t/aptos-introduces-built-in-mev-protection-with-encrypted-mempools/17175.json  
- TrX paper (IACR ePrint 2025/2032): https://eprint.iacr.org/2025/2032.pdf  

---

## Visual Storyboard (5 Scenes)

### Scene 1 — “Open Mempool = MEV”
**Visual:** Standard mempool pool with clear text packets (“BUY 1,000 APT”, “SWAP APT/USDC”).  
**Motion:** Packets float in; bot icons scan and pivot; one bot jumps ahead to reorder.  
**On‑screen text:** “Transparent mempool → MEV”  
**Callout:** “Front‑run / sandwich / order‑flow leakage”

### Scene 2 — “Encrypt at Source”
**Visual:** User wallet submits a transaction; it enters a pipeline labeled “Encrypt”.  
**Motion:** The packet morphs into ciphertext (scrambled glyphs + lock icon).  
**On‑screen text:** “Client encrypts payload → ciphertext”

### Scene 3 — “Shared Encrypted Mempool”
**Visual:** Pool fills with ciphertext packets only. Bots see locks, shrug or fade.  
**Motion:** Bots attempt to scan, receive “no data” icons.  
**On‑screen text:** “Validators see ciphertext only”
**Callout:** “Intent hidden until execution”

### Scene 4 — “Batched Threshold Decryption”
**Visual:** Validators form a ring, emit partial keys into a single decryption beam.  
**Motion:** Many ciphertexts unlock simultaneously into cleartext.  
**On‑screen text:** “Batched threshold decryption”  
**Footnote:** “<20ms expected; ~27ms (≈14%) in prototype”

### Scene 5 — “Execute + Finalize”
**Visual:** Cleartext transactions flow into execution; block seals; chain height ticks.  
**Motion:** Final block stamp; bots are late.  
**On‑screen text:** “Decrypt only after ordering”

---

## Data & Labels
- **Batch size:** 50–200 ciphertexts (visual scale).  
- **Timing:** 1–2 seconds per scene; full loop 8–10 seconds.  
- **Key label tags:** `ciphertext`, `batch decrypt`, `finalize`.

---

## Color & Style
- **Ciphertext:** Neon cyan + lock icon.  
- **Cleartext:** Warm white.  
- **Bots/MEV:** Red/orange.  
- **Validators:** Aptos green/teal.  
- **Background:** Dark, minimal grid, subtle radial vignette.

---

## UI Copy (Short Overlays)
- “MEV thrives on visibility.”  
- “Encrypt intent, not execution.”  
- “Batch decrypt = minimal overhead.”  
- “Order first. Reveal later.”

---

## Interaction Notes
- No user controls required; autoplay loop.  
- Optional pause/restart like other Pixi components.  
- For accessibility, provide a static caption below the canvas with the 2‑line summary.

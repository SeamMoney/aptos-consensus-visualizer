#!/usr/bin/env npx tsx

/**
 * HFT Gas Demo - Rapid-fire transactions with varying gas prices
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

// HFT-style: rapid random spikes with occasional mega spikes
function generateGasPrices(count: number): number[] {
  const prices: number[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    if (r < 0.4) {
      // 40%: baseline
      prices.push(100 + Math.floor(Math.random() * 100));
    } else if (r < 0.6) {
      // 20%: small spike
      prices.push(1000 + Math.floor(Math.random() * 4000));
    } else if (r < 0.75) {
      // 15%: medium spike
      prices.push(10000 + Math.floor(Math.random() * 40000));
    } else if (r < 0.88) {
      // 13%: large spike
      prices.push(100000 + Math.floor(Math.random() * 400000));
    } else {
      // 12%: mega spike
      prices.push(500000 + Math.floor(Math.random() * 500000));
    }
  }
  return prices;
}

function formatGas(gas: number): string {
  if (gas >= 1000000) return `${(gas / 1000000).toFixed(2)}M`;
  if (gas >= 1000) return `${(gas / 1000).toFixed(1)}K`;
  return gas.toString();
}

function formatTime(): string {
  return new Date().toISOString().split('T')[1].slice(0, 12);
}

async function main() {
  console.log(`\n${DIM}─────────────────────────────────────────────────────${RESET}`);
  console.log(`  APTOS GAS DEMO ${DIM}│${RESET} testnet ${DIM}│${RESET} HFT mode`);
  console.log(`${DIM}─────────────────────────────────────────────────────${RESET}\n`);

  const config = new AptosConfig({ network: Network.TESTNET });
  const aptos = new Aptos(config);

  const privateKeyHex = process.env.APTOS_PRIVATE_KEY;
  if (!privateKeyHex) {
    console.log(`${RED}error:${RESET} APTOS_PRIVATE_KEY not set`);
    process.exit(1);
  }

  const privateKey = new Ed25519PrivateKey(privateKeyHex);
  const account = Account.fromPrivateKey({ privateKey });
  const addr = account.accountAddress.toString();

  console.log(`${DIM}addr${RESET}    ${addr.slice(0, 10)}...${addr.slice(-8)}`);

  // Check balance
  try {
    const resources = await aptos.getAccountResources({ accountAddress: account.accountAddress });
    const coin = resources.find((r: any) => r.type.includes('AptosCoin'));
    if (coin) {
      const bal = parseInt((coin.data as any).coin.value) / 1e8;
      console.log(`${DIM}balance${RESET} ${bal.toFixed(4)} APT`);
    }
  } catch {}

  const txCount = 50;
  const gasPrices = generateGasPrices(txCount);

  console.log(`${DIM}txns${RESET}    ${txCount}\n`);
  console.log(`${DIM}time         gas        hash${RESET}`);
  console.log(`${DIM}───────────────────────────────────────────${RESET}`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < gasPrices.length; i++) {
    const gasPrice = gasPrices[i];
    const gasStr = formatGas(gasPrice).padStart(8);
    const time = formatTime();

    try {
      const tx = await aptos.transaction.build.simple({
        sender: account.accountAddress,
        data: {
          function: "0x1::aptos_account::transfer",
          functionArguments: [account.accountAddress, 1],
        },
        options: { gasUnitPrice: gasPrice, maxGasAmount: 1000 },
      });

      const pending = await aptos.signAndSubmitTransaction({ signer: account, transaction: tx });
      await aptos.waitForTransaction({ transactionHash: pending.hash });

      const color = gasPrice >= 100000 ? YELLOW : gasPrice >= 10000 ? CYAN : DIM;
      console.log(`${DIM}${time}${RESET} ${color}${gasStr}${RESET}  ${DIM}${pending.hash.slice(0, 16)}${RESET}`);
      success++;
    } catch (e: any) {
      console.log(`${DIM}${time}${RESET} ${RED}${gasStr}${RESET}  ${DIM}failed${RESET}`);
      failed++;
    }

    // HFT pace - fast but not too fast
    await new Promise(r => setTimeout(r, 150 + Math.random() * 100));
  }

  console.log(`${DIM}───────────────────────────────────────────${RESET}`);
  console.log(`${DIM}done${RESET} ${GREEN}${success}${RESET}/${txCount} ${DIM}(${failed} failed)${RESET}\n`);
}

main().catch(e => {
  console.error(`${RED}error:${RESET} ${e.message}`);
  process.exit(1);
});

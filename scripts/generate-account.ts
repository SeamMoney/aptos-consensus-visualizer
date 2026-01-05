import { Account } from "@aptos-labs/ts-sdk";

// Generate a new account
const account = Account.generate();

console.log("\n🔑 NEW TESTNET ACCOUNT GENERATED\n");
console.log("═══════════════════════════════════════════════════════════════════");
console.log(`ADDRESS: ${account.accountAddress.toString()}`);
console.log("═══════════════════════════════════════════════════════════════════");
console.log(`\nPrivate Key (save this): ${account.privateKey.toString()}`);
console.log("\n📝 Send testnet APT to the address above, then run:");
console.log(`   APTOS_PRIVATE_KEY="${account.privateKey.toString()}" npx ts-node scripts/spike-gas.ts\n`);

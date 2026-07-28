#!/usr/bin/env node
/**
 * Hakeem Rasd Local Agent CLI / service entry.
 * After first pairing, prefer OS service + local status UI — no ongoing Terminal required.
 */
import { pairWithCloud } from "./cloud";
import { runSelfTest } from "./execute";
import { heartbeatLoop } from "./poll";
import { startLocalStatusServer } from "./ui/status-server";
import { AGENT_VERSION, detectPlatform, loadIdentity } from "./identity";

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd || cmd === "help") {
    console.log(`Hakeem Rasd Local Agent v${AGENT_VERSION}
Commands:
  pair --cloud <url> --code <CODE> [--name <display>]
  run                 Start long-poll worker + local status UI (127.0.0.1)
  self-test           Probe BOE/NCAR/UQN + egress country
  status              Print pairing status
`);
    return;
  }

  if (cmd === "pair") {
    const cloud = argValue(args, "--cloud") || process.env.HAKEEM_CLOUD_URL;
    const code = argValue(args, "--code") || process.env.HAKEEM_PAIR_CODE;
    const name = argValue(args, "--name");
    if (!cloud || !code) throw new Error("pair requires --cloud and --code");
    const identity = await pairWithCloud({ cloudBaseUrl: cloud, code, displayName: name });
    console.log(JSON.stringify({ paired: true, agentId: identity.agentId, platform: identity.platform }, null, 2));
    return;
  }

  if (cmd === "status") {
    const identity = loadIdentity();
    console.log(JSON.stringify({ paired: Boolean(identity), identity: identity ? { agentId: identity.agentId, displayName: identity.displayName, platform: identity.platform, version: AGENT_VERSION } : null }, null, 2));
    return;
  }

  if (cmd === "self-test") {
    console.log(JSON.stringify(await runSelfTest(), null, 2));
    return;
  }

  if (cmd === "run") {
    if (!loadIdentity()) throw new Error("NOT_PAIRED — run pair first (one-time)");
    startLocalStatusServer();
    const signal = { stopped: false };
    process.on("SIGINT", () => {
      signal.stopped = true;
    });
    console.log(JSON.stringify({ message: "agent_running", platform: detectPlatform(), version: AGENT_VERSION }));
    await heartbeatLoop(signal);
    return;
  }

  throw new Error(`Unknown command: ${cmd}`);
}

function argValue(args: string[], key: string): string | undefined {
  const i = args.indexOf(key);
  if (i >= 0) return args[i + 1];
  return undefined;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

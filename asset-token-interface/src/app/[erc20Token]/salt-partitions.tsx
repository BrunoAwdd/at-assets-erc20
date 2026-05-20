"use client";

import { useState } from "react";
import { usePublicClient } from "wagmi";
import { isAddress, parseUnits, type Abi, type WalletClient } from "viem";
import {
  fmt, Card, SectionTitle, FieldLabel, TextInput, SelectInput, Btn, MaxBtn, AlertBox,
  PARTITION_UNLOCKED, PARTITION_LOCKED, PARTITIONS,
} from "./salt-ui";

export function PartitionsTab({
  tokenSymbol, userBalance, userUnlocked, userLocked,
  addr, abi, walletClient, address, refresh, publicClient,
}: {
  tokenSymbol: string | undefined;
  userBalance: bigint | undefined;
  userUnlocked: bigint | undefined;
  userLocked: bigint | undefined;
  addr: `0x${string}`; abi: Abi;
  walletClient: WalletClient | undefined;
  address: `0x${string}` | undefined;
  refresh: () => void;
  publicClient: ReturnType<typeof usePublicClient>;
}) {
  const [fromP, setFromP] = useState<string>(PARTITION_UNLOCKED);
  const [toP, setToP] = useState<string>(PARTITION_LOCKED);
  const [moveAmt, setMoveAmt] = useState("");
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveStatus, setMoveStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [lookupAddr, setLookupAddr] = useState("");
  const [lookupRes, setLookupRes] = useState<{ u: bigint; l: bigint } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const fromBal = fromP === PARTITION_UNLOCKED ? userUnlocked : userLocked;
  const unlockedPct =
    userBalance && userBalance > 0n && userUnlocked !== undefined
      ? Number((userUnlocked * 100n) / userBalance)
      : 0;

  const doMove = async () => {
    if (!walletClient || !address || !moveAmt) return;
    setMoveLoading(true);
    setMoveStatus(null);
    try {
      await walletClient.writeContract({
        address: addr, abi, functionName: "movePartition",
        args: [fromP as `0x${string}`, toP as `0x${string}`, parseUnits(moveAmt, 0)],
        account: address, chain: walletClient.chain,
      });
      setMoveStatus({ type: "success", msg: "Partition moved successfully." });
      setMoveAmt("");
      refresh();
    } catch (e: unknown) {
      setMoveStatus({ type: "error", msg: e instanceof Error ? e.message : "Error." });
    } finally {
      setMoveLoading(false);
    }
  };

  const doLookup = async () => {
    if (!publicClient || !isAddress(lookupAddr)) return;
    setLookupLoading(true);
    try {
      const [u, l] = await Promise.all([
        publicClient.readContract({ address: addr, abi, functionName: "balanceOfByPartition", args: [PARTITION_UNLOCKED as `0x${string}`, lookupAddr as `0x${string}`] }),
        publicClient.readContract({ address: addr, abi, functionName: "balanceOfByPartition", args: [PARTITION_LOCKED as `0x${string}`, lookupAddr as `0x${string}`] }),
      ]);
      setLookupRes({ u: u as bigint, l: l as bigint });
    } catch {
      setLookupRes(null);
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {address && (
        <Card>
          <SectionTitle>My Partitions</SectionTitle>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: "UNLOCKED", value: userUnlocked, color: "text-green-400" },
              { label: "LOCKED", value: userLocked, color: "text-red-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-900 rounded-lg p-4 text-center">
                <p className={`text-xs font-semibold ${color} mb-1`}>{label}</p>
                <p className="text-xl font-bold text-white">{fmt(value)}</p>
                <p className="text-xs text-gray-400">{tokenSymbol}</p>
              </div>
            ))}
          </div>
          {userBalance !== undefined && userBalance > 0n && (
            <>
              <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${unlockedPct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>UNLOCKED {unlockedPct}%</span>
                <span>LOCKED {100 - unlockedPct}%</span>
              </div>
            </>
          )}
        </Card>
      )}

      {address && (
        <Card>
          <SectionTitle>Move Between Partitions</SectionTitle>
          <p className="text-xs text-gray-400 mb-3">
            Moves tokens between partitions without changing the total ERC-20 balance.
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>From</FieldLabel>
                <SelectInput
                  value={fromP}
                  onChange={(v) => { setFromP(v); setToP(v === PARTITION_UNLOCKED ? PARTITION_LOCKED : PARTITION_UNLOCKED); }}
                  options={PARTITIONS}
                />
                <p className="text-xs text-gray-400 mt-1">Available: {fmt(fromBal)}</p>
              </div>
              <div>
                <FieldLabel>To</FieldLabel>
                <SelectInput
                  value={toP}
                  onChange={setToP}
                  options={PARTITIONS.filter((p) => p.value !== fromP)}
                />
              </div>
            </div>
            <div>
              <FieldLabel>Amount</FieldLabel>
              <div className="flex gap-2">
                <TextInput value={moveAmt} onChange={setMoveAmt} placeholder="0" />
                <MaxBtn onClick={() => setMoveAmt(fromBal?.toString() ?? "0")} />
              </div>
            </div>
            <Btn onClick={doMove} disabled={moveLoading || !moveAmt || fromP === toP} full>
              {moveLoading ? "Moving…" : "Move Partition"}
            </Btn>
            {moveStatus && <AlertBox type={moveStatus.type} message={moveStatus.msg} />}
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle>Lookup Any Address</SectionTitle>
        <div className="space-y-3">
          <div className="flex gap-2">
            <TextInput value={lookupAddr} onChange={setLookupAddr} placeholder="0x…" />
            <Btn onClick={doLookup} disabled={lookupLoading || !isAddress(lookupAddr)} variant="secondary">
              {lookupLoading ? "…" : "Lookup"}
            </Btn>
          </div>
          {lookupRes && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-900 rounded-lg p-3 text-center">
                <p className="text-xs text-green-400 font-semibold mb-1">UNLOCKED</p>
                <p className="text-lg font-bold">{fmt(lookupRes.u)}</p>
                <p className="text-xs text-gray-400">{tokenSymbol}</p>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 text-center">
                <p className="text-xs text-red-400 font-semibold mb-1">LOCKED</p>
                <p className="text-lg font-bold">{fmt(lookupRes.l)}</p>
                <p className="text-xs text-gray-400">{tokenSymbol}</p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

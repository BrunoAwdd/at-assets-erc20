"use client";

import { useState } from "react";
import { usePublicClient } from "wagmi";
import { isAddress, parseUnits, type Abi } from "viem";
import {
  fmt, shortAddr, Card, SectionTitle, FieldLabel, TextInput, Btn, Badge, InfoRow, AlertBox,
  PARTITION_UNLOCKED,
} from "./salt-ui";

export function OverviewTab({
  tokenSymbol, totalSupply, ownerAddress, isOwner, isController,
  userBalance, userUnlocked, userLocked, userIsBlocked,
  isControllable, isIssuable, addr, abi, address,
}: {
  tokenSymbol: string | undefined;
  totalSupply: bigint | undefined;
  ownerAddress: string | undefined;
  isOwner: boolean;
  isController: boolean;
  userBalance: bigint | undefined;
  userUnlocked: bigint | undefined;
  userLocked: bigint | undefined;
  userIsBlocked: boolean | undefined;
  isControllable: boolean | undefined;
  isIssuable: boolean | undefined;
  addr: `0x${string}`;
  abi: Abi;
  address: `0x${string}` | undefined;
}) {
  const [checkTo, setCheckTo] = useState("");
  const [checkAmt, setCheckAmt] = useState("");
  const [canResult, setCanResult] = useState<{ ok: boolean; reason: string } | null>(null);
  const publicClient = usePublicClient();

  const checkCanTransfer = async () => {
    if (!publicClient || !isAddress(checkTo) || !checkAmt) return;
    try {
      const result = await publicClient.readContract({
        address: addr,
        abi,
        functionName: "canTransfer",
        args: [checkTo as `0x${string}`, parseUnits(checkAmt, 0), "0x" as `0x${string}`],
        account: address,
      }) as [`0x${string}`, `0x${string}`, `0x${string}`];
      const ok = result[0] === "0x51";
      const raw = Buffer.from(result[1].slice(2), "hex").toString("utf8").replace(/\0/g, "").trim();
      setCanResult({ ok, reason: raw });
    } catch {
      setCanResult({ ok: false, reason: "Error checking" });
    }
  };

  const unlockedPct =
    userBalance && userBalance > 0n && userUnlocked !== undefined
      ? Number((userUnlocked * 100n) / userBalance)
      : 0;

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>Token Information</SectionTitle>
        <InfoRow label="Total Supply" value={`${fmt(totalSupply)} ${tokenSymbol ?? ""}`} />
        <InfoRow label="Owner" value={ownerAddress ? shortAddr(ownerAddress) : "—"} />
        <InfoRow
          label="Issuance"
          value={
            isIssuable !== undefined ? (
              <Badge color={isIssuable ? "green" : "red"}>
                {isIssuable ? "Active" : "Closed"}
              </Badge>
            ) : "—"
          }
        />
        <InfoRow
          label="Controllability"
          value={
            isControllable !== undefined ? (
              <Badge color={isControllable ? "yellow" : "red"}>
                {isControllable ? "Active" : "Revoked"}
              </Badge>
            ) : "—"
          }
        />
      </Card>

      {address && (
        <Card>
          <SectionTitle>My Wallet</SectionTitle>
          <InfoRow label="Address" value={shortAddr(address)} />
          <InfoRow label="Total Balance" value={`${fmt(userBalance)} ${tokenSymbol ?? ""}`} />
          <InfoRow label="UNLOCKED Partition" value={`${fmt(userUnlocked)} ${tokenSymbol ?? ""}`} />
          <InfoRow label="LOCKED Partition" value={`${fmt(userLocked)} ${tokenSymbol ?? ""}`} />
          {userBalance !== undefined && userBalance > 0n && (
            <div className="mt-3">
              <div className="h-2.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${unlockedPct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>UNLOCKED {unlockedPct}%</span>
                <span>LOCKED {100 - unlockedPct}%</span>
              </div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {isOwner && <Badge color="blue">Owner</Badge>}
            {isController && !isOwner && <Badge color="yellow">Controller</Badge>}
            {userIsBlocked && <Badge color="red">Blocked</Badge>}
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle>Check Transfer (canTransfer)</SectionTitle>
        <div className="space-y-3">
          <div>
            <FieldLabel>Recipient</FieldLabel>
            <TextInput value={checkTo} onChange={setCheckTo} placeholder="0x…" />
          </div>
          <div>
            <FieldLabel>Amount</FieldLabel>
            <TextInput value={checkAmt} onChange={setCheckAmt} placeholder="100" />
          </div>
          <Btn onClick={checkCanTransfer} disabled={!isAddress(checkTo) || !checkAmt}>
            Check
          </Btn>
          {canResult && (
            <AlertBox
              type={canResult.ok ? "success" : "error"}
              message={`${canResult.ok ? "✓" : "✗"} ${canResult.reason}`}
            />
          )}
        </div>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { isAddress, parseUnits, type Abi, type WalletClient } from "viem";
import {
  fmt, Card, SectionTitle, FieldLabel, TextInput, SelectInput, Btn, MaxBtn, AlertBox,
  PARTITION_UNLOCKED, PARTITION_LOCKED, PARTITIONS,
} from "./salt-ui";

export function TransferTab({
  tokenSymbol, userUnlocked, userLocked,
  addr, abi, walletClient, address, refresh,
}: {
  tokenSymbol: string | undefined;
  userUnlocked: bigint | undefined;
  userLocked: bigint | undefined;
  addr: `0x${string}`; abi: Abi;
  walletClient: WalletClient | undefined;
  address: `0x${string}` | undefined;
  refresh: () => void;
}) {
  type Form = "standard" | "withdata" | "bypartition";
  const [form, setForm] = useState<Form>("standard");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [data, setData] = useState("0x");
  const [partition, setPartition] = useState<string>(PARTITION_UNLOCKED);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const partitionBalance = partition === PARTITION_UNLOCKED ? userUnlocked : userLocked;

  const exec = async (fn: () => Promise<unknown>) => {
    if (!walletClient || !address) return;
    setLoading(true);
    setStatus(null);
    try {
      await fn();
      setStatus({ type: "success", msg: "Transaction sent successfully." });
      refresh();
    } catch (e: unknown) {
      setStatus({ type: "error", msg: e instanceof Error ? e.message : "Unknown error." });
    } finally {
      setLoading(false);
    }
  };

  const doTransfer = () =>
    exec(() =>
      walletClient!.writeContract({
        address: addr, abi, functionName: "transfer",
        args: [to as `0x${string}`, parseUnits(amount, 0)],
        account: address!, chain: walletClient!.chain,
      })
    );

  const doWithData = () =>
    exec(() =>
      walletClient!.writeContract({
        address: addr, abi, functionName: "transferWithData",
        args: [to as `0x${string}`, parseUnits(amount, 0), (data || "0x") as `0x${string}`],
        account: address!, chain: walletClient!.chain,
      })
    );

  const doByPartition = () =>
    exec(() =>
      walletClient!.writeContract({
        address: addr, abi, functionName: "transferByPartition",
        args: [partition as `0x${string}`, to as `0x${string}`, parseUnits(amount, 0), "0x" as `0x${string}`],
        account: address!, chain: walletClient!.chain,
      })
    );

  const subTabs: { id: Form; label: string }[] = [
    { id: "standard", label: "Standard ERC-20" },
    { id: "withdata", label: "With Data (ERC-1594)" },
    { id: "bypartition", label: "By Partition (ERC-1410)" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex gap-1 mb-5 bg-gray-900 p-1 rounded-lg">
          {subTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setForm(t.id); setStatus(null); }}
              className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                form === t.id ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {form === "bypartition" && (
            <div>
              <FieldLabel>Partition</FieldLabel>
              <SelectInput value={partition} onChange={setPartition} options={PARTITIONS} />
              <p className="text-xs text-gray-400 mt-1">
                Available: <span className="text-white">{fmt(partitionBalance)} {tokenSymbol}</span>
              </p>
            </div>
          )}

          {form === "standard" && (
            <p className="text-xs text-gray-400">
              Operates on UNLOCKED partition. Available:{" "}
              <span className="text-white">{fmt(userUnlocked)} {tokenSymbol}</span>
            </p>
          )}

          <div>
            <FieldLabel>Recipient</FieldLabel>
            <TextInput value={to} onChange={setTo} placeholder="0x…" />
          </div>

          <div>
            <FieldLabel>Amount</FieldLabel>
            <div className="flex gap-2">
              <TextInput value={amount} onChange={setAmount} placeholder="0" />
              <MaxBtn onClick={() => setAmount((form === "bypartition" ? partitionBalance : userUnlocked)?.toString() ?? "0")} />
            </div>
          </div>

          {form === "withdata" && (
            <div>
              <FieldLabel>Data (hex)</FieldLabel>
              <TextInput value={data} onChange={setData} placeholder="0x" />
            </div>
          )}

          <Btn
            onClick={form === "standard" ? doTransfer : form === "withdata" ? doWithData : doByPartition}
            disabled={loading || !address || !isAddress(to) || !amount}
            full
          >
            {loading ? "Sending…" : "Transfer"}
          </Btn>
          {status && <AlertBox type={status.type} message={status.msg} />}
        </div>
      </Card>

      <Card>
        <SectionTitle>Burn Tokens (Redeem)</SectionTitle>
        <RedeemForm
          tokenSymbol={tokenSymbol}
          userUnlocked={userUnlocked}
          userLocked={userLocked}
          addr={addr} abi={abi} walletClient={walletClient}
          address={address} refresh={refresh}
        />
      </Card>
    </div>
  );
}

function RedeemForm({
  tokenSymbol, userUnlocked, userLocked,
  addr, abi, walletClient, address, refresh,
}: {
  tokenSymbol: string | undefined;
  userUnlocked: bigint | undefined;
  userLocked: bigint | undefined;
  addr: `0x${string}`; abi: Abi;
  walletClient: WalletClient | undefined;
  address: `0x${string}` | undefined;
  refresh: () => void;
}) {
  const [partition, setPartition] = useState<string>(PARTITION_UNLOCKED);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const bal = partition === PARTITION_UNLOCKED ? userUnlocked : userLocked;

  const doRedeem = async () => {
    if (!walletClient || !address || !amount) return;
    setLoading(true);
    setStatus(null);
    try {
      await walletClient.writeContract({
        address: addr, abi, functionName: "redeemByPartition",
        args: [partition as `0x${string}`, parseUnits(amount, 0), "0x" as `0x${string}`],
        account: address, chain: walletClient.chain,
      });
      setStatus({ type: "success", msg: "Tokens burned successfully." });
      setAmount("");
      refresh();
    } catch (e: unknown) {
      setStatus({ type: "error", msg: e instanceof Error ? e.message : "Error." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">Permanently burns tokens, reducing total supply.</p>
      <div>
        <FieldLabel>Partition</FieldLabel>
        <SelectInput value={partition} onChange={setPartition} options={PARTITIONS} />
        <p className="text-xs text-gray-400 mt-1">
          Available: <span className="text-white">{fmt(bal)} {tokenSymbol}</span>
        </p>
      </div>
      <div>
        <FieldLabel>Amount</FieldLabel>
        <div className="flex gap-2">
          <TextInput value={amount} onChange={setAmount} placeholder="0" />
          <MaxBtn onClick={() => setAmount(bal?.toString() ?? "0")} />
        </div>
      </div>
      <Btn variant="danger" onClick={doRedeem} disabled={loading || !address || !amount} full>
        {loading ? "Burning…" : "Burn Tokens"}
      </Btn>
      {status && <AlertBox type={status.type} message={status.msg} />}
    </div>
  );
}

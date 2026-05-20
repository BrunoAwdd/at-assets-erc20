"use client";

import { useState, useEffect } from "react";
import { usePublicClient } from "wagmi";
import { decodeEventLog, type Abi, type Log } from "viem";
import { fmt, shortAddr, shortHex, Card, SectionTitle, Btn, Badge } from "./salt-ui";

interface DecodedEvent {
  blockNumber: bigint;
  txHash: `0x${string}`;
  eventName: string;
  args: Record<string, unknown>;
}

const EVENT_COLORS: Record<string, "green" | "red" | "blue" | "yellow" | "gray"> = {
  Transfer: "blue",
  Issued: "green",
  Redeemed: "red",
  IssuedByPartition: "green",
  RedeemedByPartition: "red",
  TransferByPartition: "blue",
  PartitionMoved: "yellow",
  ControllerTransfer: "yellow",
  DocumentUpdated: "gray",
  DocumentRemoved: "red",
  AddressBlocked: "red",
  AddressUnblocked: "green",
  IssuanceLocked: "red",
  ControllabilityRevoked: "red",
  AuthorizedOperator: "yellow",
  RevokedOperator: "yellow",
};

export function HistoryTab({
  addr, abi, publicClient, tokenSymbol,
}: {
  addr: `0x${string}`; abi: Abi;
  publicClient: ReturnType<typeof usePublicClient>;
  tokenSymbol: string | undefined;
}) {
  const [events, setEvents] = useState<DecodedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState(5000);

  const fetchEvents = async () => {
    if (!publicClient) return;
    setLoading(true);
    try {
      const latest = await publicClient.getBlockNumber();
      const from = latest > BigInt(range) ? latest - BigInt(range) : 0n;
      const logs = await publicClient.getLogs({ address: addr, fromBlock: from, toBlock: latest });
      const decoded: DecodedEvent[] = logs
        .map((log: Log) => {
          try {
            const d = decodeEventLog({ abi, data: log.data, topics: log.topics });
            return {
              blockNumber: log.blockNumber ?? 0n,
              txHash: (log.transactionHash || "0x0") as `0x${string}`,
              eventName: (d.eventName ?? "Unknown") as string,
              args: (d.args ?? {}) as unknown as Record<string, unknown>,
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .reverse() as DecodedEvent[];
      setEvents(decoded);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, [publicClient, addr]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatArg = (key: string, val: unknown): string => {
    if (typeof val === "bigint") {
      return key.toLowerCase().includes("value") || key.toLowerCase().includes("amount")
        ? `${fmt(val)} ${tokenSymbol ?? ""}`
        : val.toString();
    }
    if (typeof val === "string") {
      if (val.startsWith("0x") && val.length === 42) return shortAddr(val);
      if (val.startsWith("0x") && val.length === 66) return shortHex(val);
      return val;
    }
    if (typeof val === "boolean") return val ? "true" : "false";
    return String(val);
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <SectionTitle>Event History</SectionTitle>
          <div className="flex items-center gap-2">
            <select
              value={range}
              onChange={(e) => setRange(Number(e.target.value))}
              className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white"
            >
              <option value={1000}>1,000 blocks</option>
              <option value={5000}>5,000 blocks</option>
              <option value={10000}>10,000 blocks</option>
              <option value={50000}>50,000 blocks</option>
            </select>
            <Btn onClick={fetchEvents} disabled={loading} variant="secondary">
              {loading ? "…" : "Refresh"}
            </Btn>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin mr-2" />
            Fetching events…
          </div>
        )}

        {!loading && events.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-6">
            No events found in the last {range.toLocaleString("en-US")} blocks.
          </p>
        )}

        <div className="space-y-2">
          {events.map((ev, i) => (
            <div key={i} className="bg-gray-900 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <Badge color={EVENT_COLORS[ev.eventName] ?? "gray"}>{ev.eventName}</Badge>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400">Block {ev.blockNumber.toString()}</p>
                  <a
                    href={`https://bscscan.com/tx/${ev.txHash}`}
                    target="_blank" rel="noreferrer"
                    className="text-xs text-blue-400 underline"
                  >
                    {shortHex(ev.txHash)}
                  </a>
                </div>
              </div>
              <div className="space-y-0.5">
                {Object.entries(ev.args).map(([key, val]) => (
                  <div key={key} className="flex justify-between text-xs gap-2">
                    <span className="text-gray-400 shrink-0">{key}</span>
                    <span className="text-white font-mono text-right break-all">{formatArg(key, val)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useChainId, useAccount, useWalletClient, useReadContracts } from "wagmi";
import { isAddress, parseUnits, type Abi } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { Token } from "@/app/contracts";
import { fmt, PARTITION_UNLOCKED, PARTITION_LOCKED } from "./salt-ui";

const shortAddr = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

export default function SALTUserClient({ contracts: tokenContracts }: { contracts: Token }) {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const networkKey = chainId === 56 ? "bsc" : "bscTestnet";
  const contract = tokenContracts[networkKey];
  const addr = contract.address as `0x${string}`;
  const abi = contract.abi as Abi;

  const { data, refetch } = useReadContracts({
    contracts: [
      { address: addr, abi, functionName: "name" },
      { address: addr, abi, functionName: "symbol" },
      { address: addr, abi, functionName: "totalSupply" },
      ...(address
        ? [
            { address: addr, abi, functionName: "balanceOf", args: [address] },
            { address: addr, abi, functionName: "balanceOfByPartition", args: [PARTITION_UNLOCKED as `0x${string}`, address] },
            { address: addr, abi, functionName: "balanceOfByPartition", args: [PARTITION_LOCKED as `0x${string}`, address] },
            { address: addr, abi, functionName: "blocked", args: [address] },
          ]
        : []),
    ],
  });

  const tokenName    = data?.[0]?.result as string | undefined;
  const tokenSymbol  = data?.[1]?.result as string | undefined;
  const totalSupply  = data?.[2]?.result as bigint | undefined;
  const balance      = data?.[3]?.result as bigint | undefined;
  const unlocked     = data?.[4]?.result as bigint | undefined;
  const locked       = data?.[5]?.result as bigint | undefined;
  const isBlocked    = data?.[6]?.result as boolean | undefined;

  const unlockedPct =
    balance && balance > 0n && unlocked !== undefined
      ? Number((unlocked * 100n) / balance)
      : 0;

  const handleTransfer = async () => {
    if (!walletClient || !address || !isAddress(to) || !amount) return;
    setLoading(true);
    setStatus(null);
    try {
      await walletClient.writeContract({
        address: addr, abi,
        functionName: "transfer",
        args: [to as `0x${string}`, parseUnits(amount, 0)],
        account: address,
        chain: walletClient.chain,
      });
      setStatus({ ok: true, msg: "Transferência enviada com sucesso." });
      setAmount("");
      refetch();
    } catch (e: unknown) {
      setStatus({ ok: false, msg: e instanceof Error ? e.message : "Erro ao enviar." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 text-white px-4 py-12">
      <div className="w-full max-w-xl space-y-4">

        {/* Header */}
        <div className="p-6 bg-gray-900 rounded-xl border border-gray-700 shadow-xl">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold">{tokenName ?? "…"}</h1>
              <p className="text-sm text-gray-400">{tokenSymbol ?? "…"} · ERC-1400</p>
            </div>
            {!isConnected && <ConnectButton />}
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Supply Total</span>
            <span className="font-medium">{fmt(totalSupply)} {tokenSymbol}</span>
          </div>
        </div>

        {/* Wallet card */}
        {isConnected && address && (
          <div className="p-6 bg-gray-900 rounded-xl border border-gray-700 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Minha Carteira</h2>
              <span className="text-xs text-gray-400 font-mono">{shortAddr(address)}</span>
            </div>

            {isBlocked && (
              <div className="p-2 bg-red-900/40 border border-red-700 rounded text-red-300 text-xs">
                ⚠ Este endereço está bloqueado e não pode transferir tokens.
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Total</p>
                <p className="text-lg font-bold">{fmt(balance)}</p>
                <p className="text-xs text-gray-500">{tokenSymbol}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-green-400 mb-1">UNLOCKED</p>
                <p className="text-lg font-bold">{fmt(unlocked)}</p>
                <p className="text-xs text-gray-500">{tokenSymbol}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-red-400 mb-1">LOCKED</p>
                <p className="text-lg font-bold">{fmt(locked)}</p>
                <p className="text-xs text-gray-500">{tokenSymbol}</p>
              </div>
            </div>

            {balance !== undefined && balance > 0n && (
              <div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${unlockedPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>UNLOCKED {unlockedPct}%</span>
                  <span>LOCKED {100 - unlockedPct}%</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Transfer form */}
        <div className="p-6 bg-gray-900 rounded-xl border border-gray-700 shadow-xl space-y-4">
          <h2 className="text-base font-semibold">Transferir</h2>
          <p className="text-xs text-gray-400">
            Transferências operam na partição UNLOCKED. Disponível:{" "}
            <span className="text-white font-medium">{fmt(unlocked)} {tokenSymbol}</span>
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Destinatário</label>
            <input
              type="text"
              placeholder="0x…"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Quantidade</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-sm"
              />
              <button
                type="button"
                onClick={() => setAmount(unlocked?.toString() ?? "0")}
                className="px-3 py-2 text-xs border border-red-500 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors whitespace-nowrap"
              >
                Max
              </button>
            </div>
          </div>

          {!isConnected ? (
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          ) : (
            <button
              onClick={handleTransfer}
              disabled={loading || !isAddress(to) || !amount || isBlocked}
              className="w-full py-2 font-semibold rounded-lg transition-all bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Enviando…" : "Transferir"}
            </button>
          )}

          {status && (
            <div className={`p-3 rounded-lg border text-sm ${status.ok ? "bg-green-900/40 border-green-700 text-green-300" : "bg-red-900/40 border-red-700 text-red-300"}`}>
              {status.msg}
            </div>
          )}
        </div>

        {/* Secondary links */}
        <div className="flex justify-between text-xs text-gray-500">
          <a href="viewer" className="hover:text-gray-300 transition-colors underline underline-offset-2">
            Portal do investidor →
          </a>
          <a href="admin" className="hover:text-gray-300 transition-colors underline underline-offset-2">
            Painel administrativo →
          </a>
        </div>

      </div>
    </main>
  );
}

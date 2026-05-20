"use client";

import { useState } from "react";
import {
  useChainId,
  useAccount,
  useWalletClient,
  useReadContracts,
  usePublicClient,
} from "wagmi";
import { keccak256, toBytes, type Abi } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { Token } from "@/app/contracts";

import { fmt, Badge, PARTITION_UNLOCKED, PARTITION_LOCKED } from "./salt-ui";
import { OverviewTab } from "./salt-overview";
import { TransferTab } from "./salt-transfer";
import { PartitionsTab } from "./salt-partitions";
import { ControllerTab } from "./salt-controller";
import { DocumentsTab } from "./salt-documents";
import { HistoryTab } from "./salt-history";

type Tab = "overview" | "transfer" | "partitions" | "controller" | "documents" | "history";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "transfer", label: "Transfer" },
  { id: "partitions", label: "Partitions" },
  { id: "controller", label: "Controller" },
  { id: "documents", label: "Documents" },
  { id: "history", label: "History" },
];

export default function SALTClient({ contracts: tokenContracts }: { contracts: Token }) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const networkKey = chainId === 56 ? "bsc" : "bscTestnet";
  const contract = tokenContracts[networkKey];
  const addr = contract.address as `0x${string}`;
  const abi = contract.abi as Abi;

  // ─── Public reads ──────────────────────────────────────────────────────────
  const { data: pubData, refetch: refetchPub, isPending: pubPending } = useReadContracts({
    contracts: [
      { address: addr, abi, functionName: "name" },
      { address: addr, abi, functionName: "symbol" },
      { address: addr, abi, functionName: "totalSupply" },
      { address: addr, abi, functionName: "isIssuable" },
      { address: addr, abi, functionName: "isControllable" },
      { address: addr, abi, functionName: "owner" },
      { address: addr, abi, functionName: "getAllDocuments" },
    ],
  });

  const tokenName = pubData?.[0]?.result as string | undefined;
  const tokenSymbol = pubData?.[1]?.result as string | undefined;
  const totalSupply = pubData?.[2]?.result as bigint | undefined;
  const isIssuable = pubData?.[3]?.result as boolean | undefined;
  const isControllable = pubData?.[4]?.result as boolean | undefined;
  const ownerAddress = pubData?.[5]?.result as `0x${string}` | undefined;
  const allDocuments = pubData?.[6]?.result as `0x${string}`[] | undefined;

  // ─── User reads ────────────────────────────────────────────────────────────
  const { data: userData, refetch: refetchUser, isPending: userPending } = useReadContracts({
    contracts: address
      ? [
          { address: addr, abi, functionName: "balanceOf", args: [address] },
          { address: addr, abi, functionName: "blocked", args: [address] },
          { address: addr, abi, functionName: "controllers", args: [address] },
          { address: addr, abi, functionName: "balanceOfByPartition", args: [PARTITION_UNLOCKED as `0x${string}`, address] },
          { address: addr, abi, functionName: "balanceOfByPartition", args: [PARTITION_LOCKED as `0x${string}`, address] },
        ]
      : [],
    query: { enabled: !!address },
  });

  const userBalance = userData?.[0]?.result as bigint | undefined;
  const userIsBlocked = userData?.[1]?.result as boolean | undefined;
  const userIsController = userData?.[2]?.result as boolean | undefined;
  const userUnlocked = userData?.[3]?.result as bigint | undefined;
  const userLocked = userData?.[4]?.result as bigint | undefined;

  const isOwner = !!(address && ownerAddress && address.toLowerCase() === ownerAddress.toLowerCase());
  const hasControllerAccess = isOwner || !!userIsController;
  const isLoading = pubPending || (!!address && userPending);

  const refresh = () => { refetchPub(); refetchUser(); };

  const sharedProps = { addr, abi, walletClient, address, refresh };

  return (
    <div className="min-h-screen bg-gray-950 text-white pt-20 px-4 pb-12">
      <div className="max-w-4xl mx-auto">
        {/* Token header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">{tokenName ?? "…"}</h1>
            <Badge color="gray">{tokenSymbol ?? "…"}</Badge>
            <Badge color="blue">ERC-1400</Badge>
            {isIssuable !== undefined && (
              <Badge color={isIssuable ? "green" : "red"}>
                {isIssuable ? "Issuance active" : "Issuance closed"}
              </Badge>
            )}
            {isControllable !== undefined && (
              <Badge color={isControllable ? "yellow" : "red"}>
                {isControllable ? "Controllable" : "Not controllable"}
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-400">
            Total supply:{" "}
            <span className="text-white font-medium">{fmt(totalSupply)}</span>
          </p>
        </div>

        {/* Wallet warning */}
        {!isConnected && (
          <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg text-yellow-300 text-sm flex items-center justify-between gap-4">
            <span>Connect your wallet to interact with the token.</span>
            <ConnectButton />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-800 p-1 rounded-xl overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-1 ${
                activeTab === tab.id
                  ? "bg-red-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "overview" && (
          <OverviewTab
            tokenSymbol={tokenSymbol}
            totalSupply={totalSupply}
            ownerAddress={ownerAddress}
            isOwner={isOwner}
            isController={!!userIsController}
            userBalance={userBalance}
            userUnlocked={userUnlocked}
            userLocked={userLocked}
            userIsBlocked={userIsBlocked}
            isControllable={isControllable}
            isIssuable={isIssuable}
            addr={addr}
            abi={abi}
            address={address}
          />
        )}

        {activeTab === "transfer" && (
          <TransferTab
            tokenSymbol={tokenSymbol}
            userUnlocked={userUnlocked}
            userLocked={userLocked}
            {...sharedProps}
          />
        )}

        {activeTab === "partitions" && (
          <PartitionsTab
            tokenSymbol={tokenSymbol}
            userBalance={userBalance}
            userUnlocked={userUnlocked}
            userLocked={userLocked}
            publicClient={publicClient}
            {...sharedProps}
          />
        )}

        {activeTab === "controller" && (
          <ControllerTab
            hasControllerAccess={hasControllerAccess}
            isOwner={isOwner}
            isIssuable={isIssuable}
            isControllable={isControllable}
            isLoading={isLoading}
            {...sharedProps}
          />
        )}

        {activeTab === "documents" && (
          <DocumentsTab
            isOwner={isOwner}
            allDocuments={allDocuments}
            publicClient={publicClient}
            {...sharedProps}
          />
        )}

        {activeTab === "history" && (
          <HistoryTab
            addr={addr}
            abi={abi}
            publicClient={publicClient}
            tokenSymbol={tokenSymbol}
          />
        )}
      </div>
    </div>
  );
}

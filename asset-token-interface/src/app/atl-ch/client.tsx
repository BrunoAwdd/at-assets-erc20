"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContracts,
  useWalletClient,
} from "wagmi";
import { BaseError, formatUnits, isAddress, parseUnits } from "viem";
import type { Token } from "@/app/contracts";

const formatNumber = (value: bigint | undefined, decimals = 0) => {
  if (value === undefined) return "-";
  const formatted = formatUnits(value, decimals);
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals === 0 ? 0 : 6,
  }).format(Number(formatted));
};

const formatAddress = (value: string | undefined) => {
  if (!value) return "-";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const txMessage = (error: unknown) =>
  error instanceof BaseError
    ? error.shortMessage
    : error instanceof Error
      ? error.message
      : "Transaction failed.";

const defaultUnlockAt = () => {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setSeconds(0, 0);
  return date.toISOString().slice(0, 16);
};

type Position = readonly [
  depositor: string,
  beneficiary: string,
  amount: bigint,
  unlockAt: bigint,
  released: boolean,
];

export default function ClearingHouseClient({
  clearingHouseContracts,
  tokenContracts,
}: {
  clearingHouseContracts: Token;
  tokenContracts: Token;
}) {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [beneficiary, setBeneficiary] = useState("");
  const [amount, setAmount] = useState("");
  const [unlockAt, setUnlockAt] = useState(defaultUnlockAt);
  const [positionLookup, setPositionLookup] = useState("1");
  const [selectedPositionId, setSelectedPositionId] = useState<bigint | undefined>(
    1n,
  );
  const [status, setStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localNow, setLocalNow] = useState(() => new Date());
  const [chainNow, setChainNow] = useState<Date | null>(null);

  const networkKey =
    chainId === 56 ? "bsc" : chainId === 97 ? "bscTestnet" : "bscTestnet";
  const tokenData = tokenContracts[networkKey];
  const clearingHouseData = clearingHouseContracts[networkKey];
  const tokenAddress = isAddress(tokenData.address)
    ? (tokenData.address as `0x${string}`)
    : undefined;
  const clearingHouseAddress = isAddress(clearingHouseData.address)
    ? (clearingHouseData.address as `0x${string}`)
    : undefined;

  const inputPositionId = useMemo(() => {
    const trimmed = positionLookup.trim();
    if (!/^\d+$/.test(trimmed)) return undefined;
    const parsed = BigInt(trimmed);
    return parsed > 0n ? parsed : undefined;
  }, [positionLookup]);

  const readsEnabled = Boolean(address && tokenAddress && clearingHouseAddress);
  const {
    data: baseData,
    error: baseError,
    refetch: refetchBase,
  } = useReadContracts({
    contracts: readsEnabled
      ? [
          {
            address: tokenAddress,
            abi: tokenData.abi,
            functionName: "name",
          },
          {
            address: tokenAddress,
            abi: tokenData.abi,
            functionName: "symbol",
          },
          {
            address: tokenAddress,
            abi: tokenData.abi,
            functionName: "decimals",
          },
          {
            address: tokenAddress,
            abi: tokenData.abi,
            functionName: "balanceOf",
            args: [address],
          },
          {
            address: tokenAddress,
            abi: tokenData.abi,
            functionName: "allowance",
            args: [address, clearingHouseAddress],
          },
          {
            address: clearingHouseAddress,
            abi: clearingHouseData.abi,
            functionName: "owner",
          },
          {
            address: clearingHouseAddress,
            abi: clearingHouseData.abi,
            functionName: "totalLocked",
          },
          {
            address: clearingHouseAddress,
            abi: clearingHouseData.abi,
            functionName: "nextPositionId",
          },
          {
            address: clearingHouseAddress,
            abi: clearingHouseData.abi,
            functionName: "guaranteedToBeneficiary",
            args: [address],
          },
        ]
      : [],
    query: {
      enabled: readsEnabled,
    },
  });

  const {
    data: positionData,
    error: positionError,
    refetch: refetchPosition,
  } = useReadContracts({
    contracts: readsEnabled && selectedPositionId !== undefined
      ? [
          {
            address: clearingHouseAddress,
            abi: clearingHouseData.abi,
            functionName: "getPosition",
            args: [selectedPositionId],
          },
        ]
      : [],
    query: {
      enabled: readsEnabled && selectedPositionId !== undefined,
    },
  });

  const tokenName = baseData?.[0]?.result as string | undefined;
  const tokenSymbol = baseData?.[1]?.result as string | undefined;
  const decimals = (baseData?.[2]?.result as number | undefined) ?? 0;
  const balance = baseData?.[3]?.result as bigint | undefined;
  const allowance = baseData?.[4]?.result as bigint | undefined;
  const trusteeOwner = baseData?.[5]?.result as string | undefined;
  const totalLocked = baseData?.[6]?.result as bigint | undefined;
  const nextPositionId = baseData?.[7]?.result as bigint | undefined;
  const lockedInMyFavor = baseData?.[8]?.result as bigint | undefined;
  const position = positionData?.[0]?.result as Position | undefined;
  const isTrustee =
    Boolean(address && trusteeOwner) &&
    address?.toLowerCase() === trusteeOwner?.toLowerCase();
  const isConfigured = Boolean(tokenAddress && clearingHouseAddress);

  useEffect(() => {
    const interval = window.setInterval(() => setLocalNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadChainTime = async () => {
      if (!publicClient) {
        setChainNow(null);
        return;
      }

      try {
        const block = await publicClient.getBlock();
        if (!cancelled) {
          setChainNow(new Date(Number(block.timestamp) * 1000));
        }
      } catch {
        if (!cancelled) {
          setChainNow(null);
        }
      }
    };

    void loadChainTime();
    const interval = window.setInterval(loadChainTime, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [publicClient, chainId]);

  const refresh = async () => {
    await refetchBase();
    await refetchPosition();
  };

  const handleDeposit = async () => {
    setErrorMessage(null);
    setStatus(null);

    if (!walletClient || !publicClient || !address) {
      setErrorMessage("Connect a wallet.");
      return;
    }
    if (!tokenAddress || !clearingHouseAddress) {
      setErrorMessage("ATL-CH address is not configured.");
      return;
    }
    if (!isAddress(beneficiary)) {
      setErrorMessage("Invalid beneficiary address.");
      return;
    }

    const parsedAmount = parseUnits(amount || "0", decimals);
    const unlockTimestamp = BigInt(
      Math.floor(new Date(unlockAt).getTime() / 1000)
    );

    if (parsedAmount <= 0n) {
      setErrorMessage("Amount must be greater than zero.");
      return;
    }
    if (unlockTimestamp <= BigInt(Math.floor(Date.now() / 1000))) {
      setErrorMessage("Unlock date must be in the future.");
      return;
    }

    try {
      setIsSubmitting(true);

      if ((allowance ?? 0n) < parsedAmount) {
        setStatus("Approving ALT...");
        const approveHash = await walletClient.writeContract({
          address: tokenAddress,
          abi: tokenData.abi,
          functionName: "approve",
          args: [clearingHouseAddress, parsedAmount],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      setStatus("Depositing collateral...");
      const depositHash = await walletClient.writeContract({
        address: clearingHouseAddress,
        abi: clearingHouseData.abi,
        functionName: "depositCollateral",
        args: [parsedAmount, beneficiary as `0x${string}`, unlockTimestamp],
      });
      await publicClient.waitForTransactionReceipt({ hash: depositHash });

      setStatus("Collateral deposited.");
      setAmount("");
      await refresh();
    } catch (error) {
      setErrorMessage(txMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRelease = async (
    functionName:
      | "releaseCollateralToDepositor"
      | "releaseCollateralToBeneficiary"
      | "cancelAndReturnToDepositor"
  ) => {
    setErrorMessage(null);
    setStatus(null);

    if (!walletClient || !publicClient || !clearingHouseAddress) {
      setErrorMessage("Connect the trustee wallet.");
      return;
    }
    if (selectedPositionId === undefined) {
      setErrorMessage("Invalid position ID.");
      return;
    }

    try {
      setIsSubmitting(true);
      setStatus("Submitting trustee action...");
      const hash = await walletClient.writeContract({
        address: clearingHouseAddress,
        abi: clearingHouseData.abi,
        functionName,
        args: [selectedPositionId],
      });
      await publicClient.waitForTransactionReceipt({ hash });

      setStatus("Trustee action completed.");
      await refresh();
    } catch (error) {
      setErrorMessage(txMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const positionUnlockAt =
    position !== undefined
      ? new Date(Number(position[3]) * 1000).toLocaleString()
      : "-";

  return (
    <main className="min-h-screen bg-gray-950 px-4 pb-10 pt-28 text-white">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col gap-3 border-b border-gray-800 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">ATL-CH</h1>
            <p className="mt-1 text-sm text-gray-400">
              {tokenName && tokenSymbol
                ? `${tokenName} (${tokenSymbol})`
                : "ALT collateral"}
            </p>
          </div>
          <div className="grid gap-2 text-sm md:grid-cols-3">
            <Metric label="Network" value={networkKey} />
            <Metric label="Total Locked" value={formatNumber(totalLocked, decimals)} />
            <Metric label="Next ID" value={nextPositionId?.toString() ?? "-"} />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Metric
            label="Wallet Balance"
            value={`${formatNumber(balance, decimals)} ${tokenSymbol ?? ""}`}
          />
          <Metric
            label="Locked In My Favor"
            value={`${formatNumber(lockedInMyFavor, decimals)} ${
              tokenSymbol ?? ""
            }`}
          />
        </div>

        {!isConfigured && (
          <Alert tone="warn">
            ATL-CH or ALTW address is missing in contracts.ts for this network.
          </Alert>
        )}

        {baseError && (
          <Alert>{(baseError as BaseError).shortMessage || baseError.message}</Alert>
        )}
        {positionError && (
          <Alert tone="warn">
            {(positionError as BaseError).shortMessage || positionError.message}
          </Alert>
        )}
        {errorMessage && <Alert>{errorMessage}</Alert>}
        {status && <Alert tone="success">{status}</Alert>}

        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-lg border border-gray-800 bg-gray-900 p-5">
            <SectionTitle title="Deposit" />
            <div className="grid gap-4">
              <Field label="Beneficiary">
                <input
                  value={beneficiary}
                  onChange={(event) => setBeneficiary(event.target.value)}
                  placeholder="0x..."
                  className="input"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                <Field label="Amount">
                  <input
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0"
                    inputMode="decimal"
                    className="input"
                  />
                </Field>
                <Field label="Available">
                  <div className="metric-box">
                    {formatNumber(balance, decimals)}
                  </div>
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-[1fr_260px]">
                <Field label="Unlock At">
                  <input
                    value={unlockAt}
                    onChange={(event) => setUnlockAt(event.target.value)}
                    type="datetime-local"
                    className="input"
                  />
                </Field>
                <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
                  <div className="mb-2 text-xs font-medium text-gray-400">
                    Clock
                  </div>
                  <div className="grid gap-1">
                    <ClockRow label="Local" value={localNow} />
                    <ClockRow label="Chain" value={chainNow} />
                  </div>
                </div>
              </div>
              <button
                onClick={handleDeposit}
                disabled={!address || !isConfigured || isSubmitting}
                className="button-primary"
              >
                Approve and Deposit
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-gray-800 bg-gray-900 p-5">
            <SectionTitle title="Position" />
            <div className="grid gap-4">
              <Field label="Position ID">
                <div className="flex gap-2">
                  <input
                    value={positionLookup}
                    onChange={(event) => setPositionLookup(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && inputPositionId !== undefined) {
                        setSelectedPositionId(inputPositionId);
                      }
                    }}
                    inputMode="numeric"
                    className="input"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (inputPositionId !== undefined) {
                        setSelectedPositionId(inputPositionId);
                      }
                    }}
                    disabled={!isConfigured || inputPositionId === undefined}
                    className="button-secondary max-w-28"
                  >
                    Search
                  </button>
                </div>
              </Field>

              <div className="grid gap-2 rounded-lg border border-gray-800 bg-gray-950 p-4">
                <Info label="Depositor" value={formatAddress(position?.[0])} />
                <Info label="Beneficiary" value={formatAddress(position?.[1])} />
                <Info
                  label="Amount"
                  value={formatNumber(position?.[2], decimals)}
                />
                <Info label="Unlock At" value={positionUnlockAt} />
                <Info
                  label="Status"
                  value={
                    position?.[4] ? "Released" : position ? "Locked" : "-"
                  }
                />
              </div>

              {isTrustee && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <button
                    onClick={() =>
                      handleRelease("releaseCollateralToDepositor")
                    }
                    disabled={!isConfigured || isSubmitting}
                    className="button-secondary"
                  >
                    Release to Depositor
                  </button>
                  <button
                    onClick={() =>
                      handleRelease("releaseCollateralToBeneficiary")
                    }
                    disabled={!isConfigured || isSubmitting}
                    className="button-primary"
                  >
                    Release to Beneficiary
                  </button>
                  <button
                    onClick={() => handleRelease("cancelAndReturnToDepositor")}
                    disabled={!isConfigured || isSubmitting}
                    className="button-secondary"
                  >
                    Cancel
                  </button>
                </div>
              )}

              <div className="grid gap-2 rounded-lg border border-gray-800 bg-gray-950 p-4">
                <Info label="Trustee" value={formatAddress(trusteeOwner)} />
                <Info
                  label="Connected"
                  value={address ? formatAddress(address) : "-"}
                />
                <Info label="Mode" value={isTrustee ? "Trustee" : "Viewer"} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="mb-4 text-base font-semibold text-gray-100">{title}</h2>;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-300">
        {label}
      </span>
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-gray-800 bg-gray-900 px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-gray-100">{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-800 py-2 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm font-medium text-gray-100">
        {value}
      </span>
    </div>
  );
}

function ClockRow({ label, value }: { label: string; value: Date | null }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-gray-200">
        {value ? value.toLocaleString() : "-"}
      </span>
    </div>
  );
}

function Alert({
  children,
  tone = "error",
}: {
  children: React.ReactNode;
  tone?: "error" | "success" | "warn";
}) {
  const classes = {
    error: "border-red-900 bg-red-950 text-red-200",
    success: "border-emerald-900 bg-emerald-950 text-emerald-200",
    warn: "border-amber-900 bg-amber-950 text-amber-200",
  }[tone];

  return <div className={`rounded-lg border px-4 py-3 text-sm ${classes}`}>{children}</div>;
}

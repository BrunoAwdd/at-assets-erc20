"use client";

import { useState } from "react";
import {
  useAccount,
  useWalletClient,
  useReadContracts,
  useChainId,
} from "wagmi";
import { BaseError, parseUnits } from "viem";
import { Token } from "../contracts";

const formattedNumber = (number: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(number));

export default function Client({ contracts }: { contracts: Token }) {
  const chainId = useChainId();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [recipient, setRecipient] = useState<string>("");
  const [amount, setAmount] = useState<number>(0);
  const [formError, setFormError] = useState<string | null>(null);

  const networkKey =
    chainId === 56 ? "bsc" : chainId === 97 ? "bscTestnet" : "bscTestnet";

  const networkData = networkKey in contracts ? contracts[networkKey] : null;

  const { data, error, isPending } = useReadContracts({
    contracts: [
      {
        address: networkData?.address as `0x${string}`,
        abi: networkData?.abi,
        functionName: "name",
      },
      {
        address: networkData?.address as `0x${string}`,
        abi: networkData?.abi,
        functionName: "symbol",
      },
      {
        address: networkData?.address as `0x${string}`,
        abi: networkData?.abi,
        functionName: "totalSupply",
      },
      {
        address: networkData?.address as `0x${string}`,
        abi: networkData?.abi,
        functionName: "balanceOf",
        args: [address],
      },
    ],
  });

  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-lg text-gray-700">
          Connecting to your Wallet...
        </p>
      </div>
    );
  }

  if (error)
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
        Error: {(error as BaseError)?.shortMessage || error?.message}
      </div>
    );

  const [name, symbol, totalSupply, balanceOf] = data;

  const balance = balanceOf?.result as bigint;
  const supply = totalSupply?.result as bigint;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/,/g, "");
    const parsedValue = Number(rawValue);

    if (!isNaN(parsedValue)) {
      if (parsedValue > balance) {
        setFormError("Value exceeds available balance.");
        setAmount(parsedValue);
      } else {
        setFormError(null);
        setAmount(parsedValue);
      }
    }
  };

  const handleMax = () => {
    setAmount(Number(balance));
  };

  const handleTransfer = async () => {
    if (!walletClient) {
      alert("Address not found");
      return;
    }

    if (networkData === null) {
      alert("Network not found");
      return;
    }

    try {
      const tx = await walletClient.writeContract({
        address: networkData?.address as `0x${string}`,
        abi: networkData?.abi,
        functionName: "transfer",
        args: [recipient, parseUnits(amount.toString(), 0)],
      });
      console.log("Transaction has been sent:", tx);
      alert("Transaction has been sent successfully.");
    } catch (error) {
      console.error("Error while processing the transfer:", error);
      alert("Error while processing the transfer.");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="w-full max-w-xl p-8 bg-gray-900 rounded-lg shadow-xl border border-gray-700">
        <h1 className="text-2xl font-semibold text-center mb-6">
          Token Transfer
        </h1>

        {/* Informações do Token */}
        <div className="mb-6 p-4 bg-gray-800 rounded-lg shadow-md flex justify-between items-center">
          <div>
            <p className="text-md font-bold text-gray-300">Token</p>
            <p className="text-lg">{`${name.result} (${symbol.result})`}</p>
          </div>

          <div>
            <p className="text-md font-bold text-gray-300">Total Supply</p>
            <p className="text-lg">{formattedNumber(Number(supply))}</p>
          </div>
        </div>

        <form onSubmit={handleTransfer} className="space-y-6">
          {/* Input de Destinatário */}
          <div>
            <label
              htmlFor="recipient"
              className="block text-sm font-medium mb-1"
            >
              Recipient Address
            </label>
            <input
              id="recipient"
              type="text"
              placeholder="0x123...456"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              required
            />
          </div>

          {/* Input de Quantidade */}
          <div>
            <label htmlFor="amount" className="block text-sm font-medium mb-1">
              Quantity
            </label>
            <div className="flex items-center gap-2">
              <input
                id="amount"
                type="text"
                placeholder="0"
                value={new Intl.NumberFormat("en-US").format(amount)}
                onChange={handleChange}
                className={`w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 ${
                  formError
                    ? "ring-red-500 border border-red-500 "
                    : "focus:ring-blue-500"
                } transition-all`}
                required
              />
              <button
                type="button"
                onClick={handleMax}
                className="px-4 py-2 bg-transparent text-white border border-red-500 hover:bg-red-500 hover:text-white text-sm rounded-lg transition-all"
              >
                Max
              </button>
            </div>
            {formError && (
              <p className="text-sm text-red-500 mt-1">{formError}</p>
            )}
            <p className="text-sm text-gray-400 mt-1">{`Available Balance: ${
              address
                ? formattedNumber(Number(balance))
                : "Wallet not connected"
            }`}</p>
          </div>

          {/* Botão de Transferência */}
          <button
            type="submit"
            disabled={!address}
            className={`w-full py-2 font-semibold text-center rounded-lg transition-all ${
              !address
                ? "bg-gray-600 opacity-50 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-500"
            }`}
          >
            Transfer
          </button>
        </form>
      </div>
    </main>
  );
}

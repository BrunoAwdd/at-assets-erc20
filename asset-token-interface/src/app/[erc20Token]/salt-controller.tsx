"use client";

import { useState } from "react";
import { isAddress, parseUnits, type Abi, type WalletClient } from "viem";
import {
  Card, SectionTitle, FieldLabel, TextInput, Btn, AlertBox,
} from "./salt-ui";

export function ControllerTab({
  hasControllerAccess, isOwner, isIssuable, isControllable, isLoading,
  addr, abi, walletClient, address, refresh,
}: {
  hasControllerAccess: boolean;
  isOwner: boolean;
  isIssuable: boolean | undefined;
  isControllable: boolean | undefined;
  isLoading: boolean;
  addr: `0x${string}`; abi: Abi;
  walletClient: WalletClient | undefined;
  address: `0x${string}` | undefined;
  refresh: () => void;
}) {
  const [blockTarget, setBlockTarget] = useState("");
  const [ctrlFrom, setCtrlFrom] = useState("");
  const [ctrlTo, setCtrlTo] = useState("");
  const [ctrlAmt, setCtrlAmt] = useState("");
  const [newCtrl, setNewCtrl] = useState("");
  const [rmCtrl, setRmCtrl] = useState("");
  const [issueHolder, setIssueHolder] = useState("");
  const [issueAmt, setIssueAmt] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const exec = async (key: string, fn: () => Promise<unknown>) => {
    if (!walletClient || !address) return;
    setLoading(key);
    setStatus(null);
    try {
      await fn();
      setStatus({ type: "success", msg: "Transaction sent." });
      refresh();
    } catch (e: unknown) {
      setStatus({ type: "error", msg: e instanceof Error ? e.message : "Error." });
    } finally {
      setLoading(null);
    }
  };

  const write = (key: string, functionName: string, args: unknown[]) => () =>
    exec(key, () =>
      walletClient!.writeContract({
        address: addr, abi, functionName, args,
        account: address!, chain: walletClient!.chain,
      } as never)
    );

  if (!address) {
    return <Card><AlertBox type="warn" message="Connect your wallet to access the controller panel." /></Card>;
  }
  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center gap-3 text-gray-400 py-2">
          <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Checking permissions…</span>
        </div>
      </Card>
    );
  }
  if (!hasControllerAccess) {
    return <Card><AlertBox type="warn" message="Only controllers and the owner can access this panel." /></Card>;
  }

  return (
    <div className="space-y-4">
      {status && <AlertBox type={status.type} message={status.msg} />}

      {/* Block / Unblock */}
      <Card>
        <SectionTitle>Block / Unblock Address</SectionTitle>
        <p className="text-xs text-gray-400 mb-3">
          Prevents or restores transfer capability (KYC, compliance, sanctions).
        </p>
        <div className="space-y-3">
          <div>
            <FieldLabel>Address</FieldLabel>
            <TextInput value={blockTarget} onChange={setBlockTarget} placeholder="0x…" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Btn
              variant="danger"
              onClick={write("block", "blockAddress", [blockTarget as `0x${string}`])}
              disabled={!!loading || !isAddress(blockTarget)}
              full
            >
              {loading === "block" ? "…" : "Block"}
            </Btn>
            <Btn
              variant="secondary"
              onClick={write("unblock", "unblockAddress", [blockTarget as `0x${string}`])}
              disabled={!!loading || !isAddress(blockTarget)}
              full
            >
              {loading === "unblock" ? "…" : "Unblock"}
            </Btn>
          </div>
        </div>
      </Card>

      {/* Force Transfer */}
      {isControllable && (
        <Card>
          <SectionTitle>Force Transfer (ERC-1644)</SectionTitle>
          <p className="text-xs text-gray-400 mb-3">
            Forces a transfer from any address. Operates on UNLOCKED partition.
          </p>
          <div className="space-y-3">
            <div>
              <FieldLabel>From</FieldLabel>
              <TextInput value={ctrlFrom} onChange={setCtrlFrom} placeholder="0x…" />
            </div>
            <div>
              <FieldLabel>To</FieldLabel>
              <TextInput value={ctrlTo} onChange={setCtrlTo} placeholder="0x…" />
            </div>
            <div>
              <FieldLabel>Amount</FieldLabel>
              <TextInput value={ctrlAmt} onChange={setCtrlAmt} placeholder="0" />
            </div>
            <Btn
              variant="danger"
              onClick={write("ctrlTransfer", "controllerTransfer", [
                ctrlFrom as `0x${string}`, ctrlTo as `0x${string}`,
                parseUnits(ctrlAmt || "0", 0), "0x", "0x",
              ])}
              disabled={!!loading || !isAddress(ctrlFrom) || !isAddress(ctrlTo) || !ctrlAmt}
              full
            >
              {loading === "ctrlTransfer" ? "…" : "Force Transfer"}
            </Btn>
          </div>
        </Card>
      )}

      {/* Owner only */}
      {isOwner && (
        <>
          {/* Issue */}
          {isIssuable && (
            <Card>
              <SectionTitle>Issue Tokens</SectionTitle>
              <div className="space-y-3">
                <div>
                  <FieldLabel>Recipient</FieldLabel>
                  <TextInput value={issueHolder} onChange={setIssueHolder} placeholder="0x…" />
                </div>
                <div>
                  <FieldLabel>Amount</FieldLabel>
                  <TextInput value={issueAmt} onChange={setIssueAmt} placeholder="0" />
                </div>
                <Btn
                  onClick={write("issue", "issue", [issueHolder as `0x${string}`, parseUnits(issueAmt || "0", 0), "0x"])}
                  disabled={!!loading || !isAddress(issueHolder) || !issueAmt}
                  full
                >
                  {loading === "issue" ? "…" : "Issue"}
                </Btn>
              </div>
            </Card>
          )}

          {/* Add / Remove Controller */}
          <Card>
            <SectionTitle>Manage Controllers</SectionTitle>
            <div className="space-y-4">
              <div>
                <FieldLabel>Add Controller</FieldLabel>
                <div className="flex gap-2">
                  <TextInput value={newCtrl} onChange={setNewCtrl} placeholder="0x…" />
                  <Btn
                    variant="secondary"
                    onClick={write("addCtrl", "addController", [newCtrl as `0x${string}`])}
                    disabled={!!loading || !isAddress(newCtrl)}
                  >
                    {loading === "addCtrl" ? "…" : "Add"}
                  </Btn>
                </div>
              </div>
              <div>
                <FieldLabel>Remove Controller</FieldLabel>
                <div className="flex gap-2">
                  <TextInput value={rmCtrl} onChange={setRmCtrl} placeholder="0x…" />
                  <Btn
                    variant="danger"
                    onClick={write("rmCtrl", "removeController", [rmCtrl as `0x${string}`])}
                    disabled={!!loading || !isAddress(rmCtrl)}
                  >
                    {loading === "rmCtrl" ? "…" : "Remove"}
                  </Btn>
                </div>
              </div>
            </div>
          </Card>

          {/* Add / Remove Viewer */}
          <Card>
            <SectionTitle>Investor Whitelist (Viewers)</SectionTitle>
            <p className="text-xs text-gray-400 mb-3">
              Viewers have access to the privileged read portal: partitions of any address, full documents, event history and canTransfer checker.
            </p>
            <div className="space-y-4">
              <div>
                <FieldLabel>Add to Whitelist</FieldLabel>
                <div className="flex gap-2">
                  <TextInput value={newCtrl} onChange={setNewCtrl} placeholder="0x…" />
                  <Btn
                    variant="secondary"
                    onClick={write("addViewer", "addViewer", [newCtrl as `0x${string}`])}
                    disabled={!!loading || !isAddress(newCtrl)}
                  >
                    {loading === "addViewer" ? "…" : "Add"}
                  </Btn>
                </div>
              </div>
              <div>
                <FieldLabel>Remove from Whitelist</FieldLabel>
                <div className="flex gap-2">
                  <TextInput value={rmCtrl} onChange={setRmCtrl} placeholder="0x…" />
                  <Btn
                    variant="danger"
                    onClick={write("rmViewer", "removeViewer", [rmCtrl as `0x${string}`])}
                    disabled={!!loading || !isAddress(rmCtrl)}
                  >
                    {loading === "rmViewer" ? "…" : "Remove"}
                  </Btn>
                </div>
              </div>
            </div>
          </Card>

          {/* Danger zone */}
          <Card>
            <SectionTitle>Danger Zone</SectionTitle>
            <p className="text-xs text-yellow-400 mb-4">These actions are permanent and irreversible.</p>
            <div className="space-y-3">
              {isIssuable && (
                <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg gap-4">
                  <div>
                    <p className="text-sm font-medium text-white">Lock Issuance</p>
                    <p className="text-xs text-gray-400">No new tokens can be created after this.</p>
                  </div>
                  <Btn variant="danger" onClick={write("lockIssue", "lockIssuance", [])} disabled={!!loading}>
                    {loading === "lockIssue" ? "…" : "Lock"}
                  </Btn>
                </div>
              )}
              {isControllable && (
                <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg gap-4">
                  <div>
                    <p className="text-sm font-medium text-white">Revoke Controllability</p>
                    <p className="text-xs text-gray-400">Force-transfers will no longer be possible.</p>
                  </div>
                  <Btn variant="danger" onClick={write("revokeCtrl", "revokeControllability", [])} disabled={!!loading}>
                    {loading === "revokeCtrl" ? "…" : "Revoke"}
                  </Btn>
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

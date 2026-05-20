"use client";

import { useState, useEffect } from "react";
import { usePublicClient } from "wagmi";
import { keccak256, toBytes, type Abi, type WalletClient } from "viem";
import {
  shortHex, Card, SectionTitle, FieldLabel, TextInput, Btn, AlertBox,
} from "./salt-ui";

interface DocDetail {
  name: `0x${string}`;
  uri: string;
  hash: `0x${string}`;
  lastModified: bigint;
}

export function DocumentsTab({
  isOwner, allDocuments, addr, abi, walletClient, address, refresh, publicClient,
}: {
  isOwner: boolean;
  allDocuments: `0x${string}`[] | undefined;
  addr: `0x${string}`; abi: Abi;
  walletClient: WalletClient | undefined;
  address: `0x${string}` | undefined;
  refresh: () => void;
  publicClient: ReturnType<typeof usePublicClient>;
}) {
  const [docDetails, setDocDetails] = useState<DocDetail[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docName, setDocName] = useState("");
  const [docUri, setDocUri] = useState("");
  const [docHash, setDocHash] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    if (!publicClient || !allDocuments || allDocuments.length === 0) {
      setDocDetails([]);
      return;
    }
    setDocsLoading(true);
    Promise.all(
      allDocuments.map(async (name) => {
        const r = await publicClient.readContract({
          address: addr, abi, functionName: "getDocument", args: [name],
        }) as [string, `0x${string}`, bigint];
        return { name, uri: r[0], hash: r[1], lastModified: r[2] };
      })
    ).then(setDocDetails).finally(() => setDocsLoading(false));
  }, [allDocuments, publicClient, addr, abi]);

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

  const doSet = () =>
    exec("set", () => {
      const nameB32 = docName.startsWith("0x") && docName.length === 66
        ? (docName as `0x${string}`)
        : keccak256(toBytes(docName));
      const hashB32 = docHash.startsWith("0x") && docHash.length === 66
        ? (docHash as `0x${string}`)
        : keccak256(toBytes(docHash));
      return walletClient!.writeContract({
        address: addr, abi, functionName: "setDocument",
        args: [nameB32, docUri, hashB32],
        account: address!, chain: walletClient!.chain,
      });
    });

  const doRemove = (name: `0x${string}`) =>
    exec("remove", () =>
      walletClient!.writeContract({
        address: addr, abi, functionName: "removeDocument",
        args: [name], account: address!, chain: walletClient!.chain,
      })
    );

  return (
    <div className="space-y-4">
      {status && <AlertBox type={status.type} message={status.msg} />}

      <Card>
        <SectionTitle>Registered Documents ({allDocuments?.length ?? 0})</SectionTitle>
        {docsLoading && <p className="text-gray-400 text-sm">Loading…</p>}
        {!docsLoading && docDetails.length === 0 && (
          <p className="text-gray-400 text-sm">No documents registered.</p>
        )}
        <div className="space-y-3">
          {docDetails.map((doc) => (
            <div key={doc.name} className="bg-gray-900 rounded-lg p-4">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div>
                    <p className="text-xs text-gray-400">Nome (bytes32)</p>
                    <p className="text-xs font-mono text-white break-all">{shortHex(doc.name)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">URI</p>
                    <a
                      href={doc.uri.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${doc.uri.slice(7)}` : doc.uri}
                      target="_blank" rel="noreferrer"
                      className="text-xs text-blue-400 underline break-all"
                    >
                      {doc.uri}
                    </a>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Hash</p>
                    <p className="text-xs font-mono text-gray-300 break-all">{shortHex(doc.hash)}</p>
                  </div>
                  <p className="text-xs text-gray-400">
                    Modified: {new Date(Number(doc.lastModified) * 1000).toLocaleString("en-US")}
                  </p>
                </div>
                {isOwner && (
                  <Btn variant="danger" onClick={() => doRemove(doc.name)} disabled={!!loading}>
                    {loading === "remove" ? "…" : "Remove"}
                  </Btn>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {isOwner && (
        <Card>
          <SectionTitle>Add / Update Document</SectionTitle>
          <p className="text-xs text-gray-400 mb-3">
            The name can be text (will be converted via keccak256) or direct bytes32 hex.
          </p>
          <div className="space-y-3">
            <div>
              <FieldLabel>Document Name</FieldLabel>
              <TextInput value={docName} onChange={setDocName} placeholder="prospecto, whitepaper…" />
            </div>
            <div>
              <FieldLabel>URI (IPFS or HTTPS)</FieldLabel>
              <TextInput value={docUri} onChange={setDocUri} placeholder="ipfs://Qm… ou https://…" />
            </div>
            <div>
              <FieldLabel>Content Hash</FieldLabel>
              <TextInput value={docHash} onChange={setDocHash} placeholder="texto ou 0x… (bytes32)" />
            </div>
            <Btn onClick={doSet} disabled={!!loading || !docName || !docUri || !docHash} full>
              {loading === "set" ? "Saving…" : "Save Document"}
            </Btn>
          </div>
        </Card>
      )}
    </div>
  );
}

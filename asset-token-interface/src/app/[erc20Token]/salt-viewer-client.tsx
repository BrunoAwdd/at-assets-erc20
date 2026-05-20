"use client";

import { useState, useEffect } from "react";
import { useChainId, useAccount, useReadContracts, usePublicClient } from "wagmi";
import { isAddress, parseUnits, decodeEventLog, type Abi, type Log } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { Token } from "@/app/contracts";
import {
  fmt, shortAddr, shortHex,
  PARTITION_UNLOCKED, PARTITION_LOCKED,
  Card, SectionTitle, FieldLabel, TextInput, Btn, Badge, InfoRow, AlertBox,
} from "./salt-ui";

// ─── Access gate ─────────────────────────────────────────────────────────────
function AccessDenied() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 bg-red-900/40 border border-red-700 rounded-full flex items-center justify-center mx-auto">
          <span className="text-2xl">🔒</span>
        </div>
        <div>
          <h1 className="text-xl font-bold mb-2">Acesso Restrito</h1>
          <p className="text-gray-400 text-sm">
            Este portal é exclusivo para investidores verificados (KYC).
            Seu endereço não está na whitelist de acesso.
          </p>
        </div>
        <div className="p-4 bg-gray-800 rounded-xl border border-gray-700 text-left text-sm space-y-2">
          <p className="text-gray-300 font-medium">Para solicitar acesso:</p>
          <p className="text-gray-400">Entre em contato com o emissor do token e forneça seu endereço de carteira para verificação KYC.</p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <ConnectButton />
          <a href=".." className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2">
            ← Voltar à página do token
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SALTViewerClient({ contracts: tokenContracts }: { contracts: Token }) {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const networkKey = chainId === 56 ? "bsc" : "bscTestnet";
  const contract = tokenContracts[networkKey];
  const addr = contract.address as `0x${string}`;
  const abi = contract.abi as Abi;

  // ─── Public + user reads ──────────────────────────────────────────────────
  const { data } = useReadContracts({
    contracts: [
      { address: addr, abi, functionName: "name" },
      { address: addr, abi, functionName: "symbol" },
      { address: addr, abi, functionName: "totalSupply" },
      { address: addr, abi, functionName: "isIssuable" },
      { address: addr, abi, functionName: "isControllable" },
      { address: addr, abi, functionName: "owner" },
      { address: addr, abi, functionName: "getAllDocuments" },
      ...(address
        ? [
            { address: addr, abi, functionName: "viewers", args: [address] },
            { address: addr, abi, functionName: "controllers", args: [address] },
            { address: addr, abi, functionName: "balanceOf", args: [address] },
            { address: addr, abi, functionName: "balanceOfByPartition", args: [PARTITION_UNLOCKED as `0x${string}`, address] },
            { address: addr, abi, functionName: "balanceOfByPartition", args: [PARTITION_LOCKED as `0x${string}`, address] },
          ]
        : []),
    ],
  });

  const tokenName       = data?.[0]?.result as string | undefined;
  const tokenSymbol     = data?.[1]?.result as string | undefined;
  const totalSupply     = data?.[2]?.result as bigint | undefined;
  const isIssuable      = data?.[3]?.result as boolean | undefined;
  const isControllable  = data?.[4]?.result as boolean | undefined;
  const ownerAddress    = data?.[5]?.result as string | undefined;
  const allDocuments    = data?.[6]?.result as `0x${string}`[] | undefined;
  const isViewer        = data?.[7]?.result as boolean | undefined;
  const isController    = data?.[8]?.result as boolean | undefined;
  const userBalance     = data?.[9]?.result as bigint | undefined;
  const userUnlocked    = data?.[10]?.result as bigint | undefined;
  const userLocked      = data?.[11]?.result as bigint | undefined;

  const isOwner = !!(address && ownerAddress && address.toLowerCase() === ownerAddress.toLowerCase());
  const hasAccess = isOwner || !!isController || !!isViewer;

  // ─── Gate: wallet não conectada ───────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <h1 className="text-xl font-bold">Portal do Investidor</h1>
          <p className="text-gray-400 text-sm">Conecte sua carteira para verificar o acesso.</p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  // ─── Gate: sem acesso ─────────────────────────────────────────────────────
  if (isConnected && isViewer === false && isController === false && !isOwner) {
    return <AccessDenied />;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pt-20 px-4 pb-12">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h1 className="text-2xl font-bold">{tokenName ?? "…"}</h1>
          <Badge color="gray">{tokenSymbol ?? "…"}</Badge>
          <Badge color="blue">ERC-1400</Badge>
          <Badge color="green">Portal do Investidor</Badge>
          {isOwner && <Badge color="blue">Owner</Badge>}
          {isController && <Badge color="yellow">Controller</Badge>}
          {isViewer && !isOwner && !isController && <Badge color="green">Viewer</Badge>}
        </div>

        {/* Token stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Supply Total", value: `${fmt(totalSupply)}`, sub: tokenSymbol },
            { label: "Emissão", value: isIssuable === undefined ? "…" : isIssuable ? "Ativa" : "Encerrada", highlight: isIssuable === false ? "text-red-400" : "text-green-400" },
            { label: "Controlabilidade", value: isControllable === undefined ? "…" : isControllable ? "Ativa" : "Revogada", highlight: isControllable === false ? "text-red-400" : "text-yellow-400" },
            { label: "Documentos", value: String(allDocuments?.length ?? "…"), sub: "registrados" },
          ].map(({ label, value, sub, highlight }) => (
            <div key={label} className="bg-gray-800 rounded-xl border border-gray-700 p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className={`text-lg font-bold ${highlight ?? "text-white"}`}>{value}</p>
              {sub && <p className="text-xs text-gray-500">{sub}</p>}
            </div>
          ))}
        </div>

        {/* My wallet */}
        {address && userBalance !== undefined && (
          <Card>
            <SectionTitle>Minha Posição</SectionTitle>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-gray-900 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">Total</p>
                <p className="text-xl font-bold">{fmt(userBalance)}</p>
                <p className="text-xs text-gray-500">{tokenSymbol}</p>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 text-center">
                <p className="text-xs text-green-400 mb-1">UNLOCKED</p>
                <p className="text-xl font-bold">{fmt(userUnlocked)}</p>
                <p className="text-xs text-gray-500">{tokenSymbol}</p>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 text-center">
                <p className="text-xs text-red-400 mb-1">LOCKED</p>
                <p className="text-xl font-bold">{fmt(userLocked)}</p>
                <p className="text-xs text-gray-500">{tokenSymbol}</p>
              </div>
            </div>
            {userBalance > 0n && (
              <>
                <div className="h-2.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${userUnlocked !== undefined ? Number((userUnlocked * 100n) / userBalance) : 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>UNLOCKED {userUnlocked !== undefined ? Number((userUnlocked * 100n) / userBalance) : 0}%</span>
                  <span>LOCKED {userLocked !== undefined ? Number((userLocked * 100n) / userBalance) : 0}%</span>
                </div>
              </>
            )}
          </Card>
        )}

        {/* Token info */}
        <Card>
          <SectionTitle>Informações do Emissor</SectionTitle>
          <InfoRow label="Endereço do Contrato" value={<span className="font-mono text-xs">{shortAddr(addr)}</span>} />
          <InfoRow label="Owner / Emissor" value={ownerAddress ? <span className="font-mono text-xs">{shortAddr(ownerAddress)}</span> : "—"} />
          <InfoRow label="Emissão de novos tokens" value={
            isIssuable !== undefined
              ? <Badge color={isIssuable ? "green" : "red"}>{isIssuable ? "Permitida" : "Encerrada"}</Badge>
              : "—"
          } />
          <InfoRow label="Force-transfer (ERC-1644)" value={
            isControllable !== undefined
              ? <Badge color={isControllable ? "yellow" : "red"}>{isControllable ? "Habilitado" : "Revogado"}</Badge>
              : "—"
          } />
        </Card>

        {/* Partition lookup */}
        <PartitionLookup addr={addr} abi={abi} publicClient={publicClient} tokenSymbol={tokenSymbol} />

        {/* canTransfer checker */}
        <CanTransferChecker addr={addr} abi={abi} publicClient={publicClient} userAddress={address} />

        {/* Documents */}
        <DocumentsViewer addr={addr} abi={abi} publicClient={publicClient} allDocuments={allDocuments} />

        {/* Event history */}
        <EventHistory addr={addr} abi={abi} publicClient={publicClient} tokenSymbol={tokenSymbol} />

        {/* Footer links */}
        <div className="flex justify-between text-xs text-gray-600 pt-2">
          <a href=".." className="hover:text-gray-400 underline underline-offset-2">← Token</a>
          {(isOwner || isController) && (
            <a href="admin" className="hover:text-gray-400 underline underline-offset-2">Painel Admin →</a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Partition Lookup ─────────────────────────────────────────────────────────
function PartitionLookup({
  addr, abi, publicClient, tokenSymbol,
}: {
  addr: `0x${string}`; abi: Abi;
  publicClient: ReturnType<typeof usePublicClient>;
  tokenSymbol: string | undefined;
}) {
  const [target, setTarget] = useState("");
  const [result, setResult] = useState<{ unlocked: bigint; locked: bigint } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = async () => {
    if (!publicClient || !isAddress(target)) return;
    setLoading(true);
    setError(null);
    try {
      const [u, l] = await Promise.all([
        publicClient.readContract({ address: addr, abi, functionName: "balanceOfByPartition", args: [PARTITION_UNLOCKED as `0x${string}`, target as `0x${string}`] }),
        publicClient.readContract({ address: addr, abi, functionName: "balanceOfByPartition", args: [PARTITION_LOCKED as `0x${string}`, target as `0x${string}`] }),
      ]);
      setResult({ unlocked: u as bigint, locked: l as bigint });
    } catch {
      setError("Erro ao consultar endereço.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <SectionTitle>Consulta de Partições por Endereço</SectionTitle>
      <p className="text-xs text-gray-400 mb-3">
        Visualize a posição UNLOCKED e LOCKED de qualquer endereço.
      </p>
      <div className="flex gap-2 mb-3">
        <TextInput value={target} onChange={setTarget} placeholder="0x…" />
        <Btn onClick={lookup} disabled={loading || !isAddress(target)} variant="secondary">
          {loading ? "…" : "Consultar"}
        </Btn>
      </div>
      {error && <AlertBox type="error" message={error} />}
      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-900 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Total</p>
              <p className="text-lg font-bold">{fmt(result.unlocked + result.locked)}</p>
              <p className="text-xs text-gray-500">{tokenSymbol}</p>
            </div>
            <div className="bg-gray-900 rounded-lg p-3 text-center">
              <p className="text-xs text-green-400 mb-1">UNLOCKED</p>
              <p className="text-lg font-bold">{fmt(result.unlocked)}</p>
              <p className="text-xs text-gray-500">{tokenSymbol}</p>
            </div>
            <div className="bg-gray-900 rounded-lg p-3 text-center">
              <p className="text-xs text-red-400 mb-1">LOCKED</p>
              <p className="text-lg font-bold">{fmt(result.locked)}</p>
              <p className="text-xs text-gray-500">{tokenSymbol}</p>
            </div>
          </div>
          {(result.unlocked + result.locked) > 0n && (
            <div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${Number((result.unlocked * 100n) / (result.unlocked + result.locked))}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>UNLOCKED {Number((result.unlocked * 100n) / (result.unlocked + result.locked))}%</span>
                <span>LOCKED {Number((result.locked * 100n) / (result.unlocked + result.locked))}%</span>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── canTransfer Checker ──────────────────────────────────────────────────────
function CanTransferChecker({
  addr, abi, publicClient, userAddress,
}: {
  addr: `0x${string}`; abi: Abi;
  publicClient: ReturnType<typeof usePublicClient>;
  userAddress: `0x${string}` | undefined;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [result, setResult] = useState<{ ok: boolean; reason: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const check = async () => {
    if (!publicClient || !isAddress(from) || !isAddress(to) || !amount) return;
    setLoading(true);
    try {
      const res = await publicClient.readContract({
        address: addr, abi, functionName: "canTransfer",
        args: [to as `0x${string}`, parseUnits(amount, 0), "0x" as `0x${string}`],
        account: from as `0x${string}`,
      }) as [`0x${string}`, `0x${string}`, `0x${string}`];
      const ok = res[0] === "0x51";
      const raw = Buffer.from(res[1].slice(2), "hex").toString("utf8").replace(/\0/g, "").trim();
      setResult({ ok, reason: raw });
    } catch {
      setResult({ ok: false, reason: "Erro ao verificar." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <SectionTitle>Verificador de Transferência (canTransfer)</SectionTitle>
      <p className="text-xs text-gray-400 mb-3">
        Simule se uma transferência entre dois endereços é permitida.
      </p>
      <div className="space-y-3">
        <div>
          <FieldLabel>Remetente</FieldLabel>
          <div className="flex gap-2">
            <TextInput value={from} onChange={setFrom} placeholder="0x…" />
            {userAddress && (
              <Btn variant="secondary" onClick={() => setFrom(userAddress)}>Eu</Btn>
            )}
          </div>
        </div>
        <div>
          <FieldLabel>Destinatário</FieldLabel>
          <TextInput value={to} onChange={setTo} placeholder="0x…" />
        </div>
        <div>
          <FieldLabel>Quantidade</FieldLabel>
          <TextInput value={amount} onChange={setAmount} placeholder="0" />
        </div>
        <Btn
          onClick={check}
          disabled={loading || !isAddress(from) || !isAddress(to) || !amount}
        >
          {loading ? "Verificando…" : "Verificar"}
        </Btn>
        {result && (
          <AlertBox
            type={result.ok ? "success" : "error"}
            message={`${result.ok ? "✓ Permitida" : "✗ Negada"} — ${result.reason}`}
          />
        )}
      </div>
    </Card>
  );
}

// ─── Documents Viewer ─────────────────────────────────────────────────────────
function DocumentsViewer({
  addr, abi, publicClient, allDocuments,
}: {
  addr: `0x${string}`; abi: Abi;
  publicClient: ReturnType<typeof usePublicClient>;
  allDocuments: `0x${string}`[] | undefined;
}) {
  const [docs, setDocs] = useState<{ name: `0x${string}`; uri: string; hash: `0x${string}`; ts: bigint }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicClient || !allDocuments || allDocuments.length === 0) { setDocs([]); return; }
    setLoading(true);
    Promise.all(
      allDocuments.map(async (name) => {
        const r = await publicClient.readContract({
          address: addr, abi, functionName: "getDocument", args: [name],
        }) as [string, `0x${string}`, bigint];
        return { name, uri: r[0], hash: r[1], ts: r[2] };
      })
    ).then(setDocs).finally(() => setLoading(false));
  }, [allDocuments, publicClient, addr, abi]);

  return (
    <Card>
      <SectionTitle>Documentos Legais ({allDocuments?.length ?? 0})</SectionTitle>
      {loading && <p className="text-sm text-gray-400">Carregando…</p>}
      {!loading && docs.length === 0 && (
        <p className="text-sm text-gray-400">Nenhum documento registrado.</p>
      )}
      <div className="space-y-3">
        {docs.map((doc) => (
          <div key={doc.name} className="bg-gray-900 rounded-lg p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 flex-1 min-w-0">
                <div>
                  <p className="text-xs text-gray-500">Nome (bytes32)</p>
                  <p className="text-xs font-mono text-gray-300 break-all">{shortHex(doc.name)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">URI</p>
                  <a
                    href={doc.uri.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${doc.uri.slice(7)}` : doc.uri}
                    target="_blank" rel="noreferrer"
                    className="text-xs text-blue-400 underline break-all"
                  >
                    {doc.uri}
                  </a>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Hash do conteúdo</p>
                  <p className="text-xs font-mono text-gray-400 break-all">{doc.hash}</p>
                </div>
                <p className="text-xs text-gray-500">
                  Última modificação: {new Date(Number(doc.ts) * 1000).toLocaleString("pt-BR")}
                </p>
              </div>
              <a
                href={doc.uri.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${doc.uri.slice(7)}` : doc.uri}
                target="_blank" rel="noreferrer"
                className="shrink-0 px-3 py-1.5 text-xs bg-blue-900/40 border border-blue-700 text-blue-300 rounded-lg hover:bg-blue-800/40 transition-colors"
              >
                Abrir
              </a>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Event History ────────────────────────────────────────────────────────────
const EVENT_COLORS: Record<string, "green" | "red" | "blue" | "yellow" | "gray"> = {
  Transfer: "blue", Issued: "green", Redeemed: "red",
  IssuedByPartition: "green", RedeemedByPartition: "red",
  TransferByPartition: "blue", PartitionMoved: "yellow",
  ControllerTransfer: "yellow", DocumentUpdated: "gray", DocumentRemoved: "red",
  AddressBlocked: "red", AddressUnblocked: "green",
  IssuanceLocked: "red", ControllabilityRevoked: "red",
  ViewerAdded: "green", ViewerRemoved: "red",
};

function EventHistory({
  addr, abi, publicClient, tokenSymbol,
}: {
  addr: `0x${string}`; abi: Abi;
  publicClient: ReturnType<typeof usePublicClient>;
  tokenSymbol: string | undefined;
}) {
  const [events, setEvents] = useState<{ blockNumber: bigint; txHash: `0x${string}`; eventName: string; args: Record<string, unknown> }[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState(5000);
  const [filter, setFilter] = useState("");

  const fetch = async () => {
    if (!publicClient) return;
    setLoading(true);
    try {
      const latest = await publicClient.getBlockNumber();
      const from = latest > BigInt(range) ? latest - BigInt(range) : 0n;
      const logs = await publicClient.getLogs({ address: addr, fromBlock: from, toBlock: latest });
      const decoded = logs
        .map((log: Log) => {
          try {
            const d = decodeEventLog({ abi, data: log.data, topics: log.topics });
            return {
              blockNumber: log.blockNumber ?? 0n,
              txHash: (log.transactionHash || "0x0") as `0x${string}`,
              eventName: (d.eventName ?? "Unknown") as string,
              args: (d.args ?? {}) as unknown as Record<string, unknown>,
            };
          } catch { return null; }
        })
        .filter(Boolean)
        .reverse() as typeof events;
      setEvents(decoded);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [publicClient, addr]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatArg = (key: string, val: unknown): string => {
    if (typeof val === "bigint")
      return key.toLowerCase().includes("value") || key.toLowerCase().includes("amount")
        ? `${fmt(val)} ${tokenSymbol ?? ""}` : val.toString();
    if (typeof val === "string") {
      if (val.startsWith("0x") && val.length === 42) return shortAddr(val);
      if (val.startsWith("0x") && val.length === 66) return shortHex(val);
      return val;
    }
    if (typeof val === "boolean") return val ? "true" : "false";
    return String(val);
  };

  const filtered = filter
    ? events.filter((e) => e.eventName.toLowerCase().includes(filter.toLowerCase()))
    : events;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <SectionTitle>Histórico de Eventos</SectionTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar evento…"
            className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white placeholder-gray-500 w-36"
          />
          <select
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
            className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white"
          >
            <option value={1000}>1.000 blocos</option>
            <option value={5000}>5.000 blocos</option>
            <option value={10000}>10.000 blocos</option>
            <option value={50000}>50.000 blocos</option>
          </select>
          <Btn onClick={fetch} disabled={loading} variant="secondary">
            {loading ? "…" : "Atualizar"}
          </Btn>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin mr-2" />
          Buscando eventos…
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-6">
          Nenhum evento encontrado.
        </p>
      )}

      <div className="space-y-2">
        {filtered.map((ev, i) => (
          <div key={i} className="bg-gray-900 rounded-lg p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <Badge color={EVENT_COLORS[ev.eventName] ?? "gray"}>{ev.eventName}</Badge>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-400">Bloco {ev.blockNumber.toString()}</p>
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
  );
}

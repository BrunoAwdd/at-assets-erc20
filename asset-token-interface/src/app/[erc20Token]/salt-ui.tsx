"use client";

import { keccak256, toBytes } from "viem";

// ─── Partition constants ─────────────────────────────────────────────────────
export const PARTITION_UNLOCKED = keccak256(toBytes("UNLOCKED"));
export const PARTITION_LOCKED = keccak256(toBytes("LOCKED"));

export const PARTITIONS = [
  { value: PARTITION_UNLOCKED, label: "UNLOCKED" },
  { value: PARTITION_LOCKED, label: "LOCKED" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
export const fmt = (val: bigint | undefined) =>
  val !== undefined ? new Intl.NumberFormat("en-US").format(Number(val)) : "—";

export const shortAddr = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;
export const shortHex = (hex: string) => `${hex.slice(0, 10)}…${hex.slice(-6)}`;

// ─── UI primitives ───────────────────────────────────────────────────────────
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-gray-800 rounded-xl border border-gray-700 p-5 ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-white mb-4">{children}</h3>;
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-gray-300 mb-1">{children}</label>
  );
}

export function TextInput({
  value, onChange, placeholder, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-sm disabled:opacity-50"
    />
  );
}

export function SelectInput({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-500 text-sm"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Btn({
  children, onClick, disabled, variant = "primary", full,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  full?: boolean;
}) {
  const v = {
    primary: "bg-red-600 hover:bg-red-700 text-white",
    secondary: "bg-gray-700 hover:bg-gray-600 text-white",
    danger: "bg-red-950 hover:bg-red-900 text-red-300 border border-red-800",
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${v} ${full ? "w-full" : ""}`}
    >
      {children}
    </button>
  );
}

export function MaxBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2 text-xs border border-red-500 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors whitespace-nowrap"
    >
      Max
    </button>
  );
}

export function Badge({
  children, color = "gray",
}: {
  children: React.ReactNode;
  color?: "green" | "red" | "yellow" | "gray" | "blue";
}) {
  const c = {
    green: "bg-green-900 text-green-300 border border-green-700",
    red: "bg-red-900 text-red-300 border border-red-700",
    yellow: "bg-yellow-900 text-yellow-300 border border-yellow-700",
    blue: "bg-blue-900 text-blue-300 border border-blue-700",
    gray: "bg-gray-700 text-gray-300",
  }[color];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${c}`}>
      {children}
    </span>
  );
}

export function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-700 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm text-white font-medium">{value}</span>
    </div>
  );
}

export function AlertBox({
  message, type = "error",
}: {
  message: string;
  type?: "error" | "warn" | "success";
}) {
  const c = {
    error: "bg-red-900/40 border-red-700 text-red-300",
    warn: "bg-yellow-900/40 border-yellow-700 text-yellow-300",
    success: "bg-green-900/40 border-green-700 text-green-300",
  }[type];
  return <div className={`p-3 rounded-lg border text-sm ${c}`}>{message}</div>;
}

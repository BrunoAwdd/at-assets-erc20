"use client";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 shadow-lg border-b border-gray-700 z-50">
      <div className="container mx-auto flex justify-between items-center px-8 py-4">
        {/* Logotipo */}
        <h1 className="text-2xl font-extrabold text-white tracking-wide drop-shadow-lg">
          AssetToken <span className="text-blue-400">Interface</span>
        </h1>

        {/* Botão de Conexão */}
        <div className="flex items-center space-x-4">
          <ConnectButton label="Connect Wallet" showBalance={false} />
        </div>
      </div>
    </header>
  );
}

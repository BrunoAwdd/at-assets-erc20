import { Metadata } from "next";
import { contracts } from "@/app/contracts";
import SALTClient from "../salt-client";

export const metadata: Metadata = {
  title: "Admin · Token",
  description: "Painel administrativo ERC-1400",
};

export const revalidate = 900;

const ERC1400_TOKENS = new Set(["salt", "salt1", "saltt"]);

export default async function AdminPage({
  params,
}: {
  params: Promise<{ erc20Token: string }>;
}) {
  const { erc20Token } = await params;

  if (!Object.prototype.hasOwnProperty.call(contracts, erc20Token)) {
    return (
      <div className="rounded-sm bg-white shadow-md dark:bg-slate-900 min-h-screen flex justify-center items-center">
        <div className="p-6 rounded-lg shadow-lg text-center text-lg font-bold">
          Invalid token!
        </div>
      </div>
    );
  }

  if (!ERC1400_TOKENS.has(erc20Token)) {
    return (
      <div className="rounded-sm bg-white shadow-md dark:bg-slate-900 min-h-screen flex justify-center items-center">
        <div className="p-6 rounded-lg shadow-lg text-center text-lg font-bold">
          Token does not support ERC-1400 admin panel.
        </div>
      </div>
    );
  }

  return <SALTClient contracts={contracts[erc20Token]} />;
}

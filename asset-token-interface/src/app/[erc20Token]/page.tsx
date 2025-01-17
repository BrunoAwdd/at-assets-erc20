import { Metadata } from "next";
import { contracts } from "@/app/contracts";
import Client from "./client";

export const metadata: Metadata = {
  title: "Token",
  description: "Token Page",
};

// 15 minutes
export const revalidate = 900;

export default async function ApproveNewUserPage({
  params,
}: {
  params: Promise<{ erc20Token: string }>;
}) {
  const resolvedParams = await params;
  // 🔥 Verificação segura para evitar problemas com herança de protótipos
  if (
    !Object.prototype.hasOwnProperty.call(contracts, resolvedParams.erc20Token)
  ) {
    return (
      <div className="rounded-sm bg-white shadow-md dark:bg-slate-900 min-h-screen flex justify-center items-center">
        <div className="bg-slate-900 p-6 rounded-lg shadow-lg text-center text-lg font-bold">
          Invalid token!
        </div>
      </div>
    );
  }

  const contract = contracts[resolvedParams.erc20Token];

  return (
    <div className="rounded-sm bg-white shadow-md dark:bg-slate-900">
      <Client contracts={contract} />
    </div>
  );
}

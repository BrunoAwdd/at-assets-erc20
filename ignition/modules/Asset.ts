// SPDX-License-Identifier: MIT
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const AssetModule = buildModule("AssetModule", (m) => {
  // Parâmetros configuráveis para o token
  const tokenName = m.getParameter("tokenName", "Asset");
  const tokenSymbol = m.getParameter("tokenSymbol", "AST");
  const initialSupply = m.getParameter("initialSupply", 1_360_000_000);

  // Implantação do contrato Asset
  const asset = m.contract("Asset", [], {
    value: 0n, // Sem envio de ETH durante o deploy
  });

  return { asset };
});

export default AssetModule;

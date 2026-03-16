// SPDX-License-Identifier: MIT
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const AltModule = buildModule("AltTModule", (m) => {
  // Parâmetros configuráveis para o token
  const tokenName = m.getParameter("tokenName", "503-ALTT");
  const tokenSymbol = m.getParameter("tokenSymbol", "ALTT");
  const initialSupply = m.getParameter("initialSupply", 1_360_450_000);

  // Implantação do contrato Asset
  const asset = m.contract("AltT", [], {
    value: 0n, // Sem envio de ETH durante o deploy
  });

  return { asset };
});

export default AltModule;

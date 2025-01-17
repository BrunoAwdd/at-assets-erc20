// SPDX-License-Identifier: MIT
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const AltModule = buildModule("AltModule", (m) => {
  // Parâmetros configuráveis para o token
  const tokenName = m.getParameter("tokenName", "503-ALT");
  const tokenSymbol = m.getParameter("tokenSymbol", "ALT");
  const initialSupply = m.getParameter("initialSupply", 6_802_250_000);

  // Implantação do contrato Asset
  const asset = m.contract("Alt", [], {
    value: 0n, // Sem envio de ETH durante o deploy
  });

  return { asset };
});

export default AltModule;

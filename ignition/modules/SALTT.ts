// SPDX-License-Identifier: MIT
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SALTTModule = buildModule("SALTTModule", (m) => {
  // SALTT - Security ALT-T Token (ERC-1400 compatible, ERC-20 retrocompatível)
  const saltt = m.contract("SALTT", [], {
    value: 0n,
  });

  return { saltt };
});

export default SALTTModule;

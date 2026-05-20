// SPDX-License-Identifier: MIT
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SALTModule = buildModule("SALTModule", (m) => {
  // SALT - Security ALT Token (ERC-1400 compatible, ERC-20 retrocompatível)
  const salt = m.contract("SALT", [], {
    value: 0n,
  });

  return { salt };
});

export default SALTModule;

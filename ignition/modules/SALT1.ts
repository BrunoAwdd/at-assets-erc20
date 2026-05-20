// SPDX-License-Identifier: MIT
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SALT1Module = buildModule("SALT1Module", (m) => {
  // SALT1 - Security ALT-1 Token (ERC-1400 compatible, ERC-20 retrocompatível)
  const salt1 = m.contract("SALT1", [], {
    value: 0n,
  });

  return { salt1 };
});

export default SALT1Module;

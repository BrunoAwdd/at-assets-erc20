// SPDX-License-Identifier: MIT
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const AltWModule = buildModule("AltWModule", (m) => {
  const altw = m.contract("AltW", [], {
    value: 0n,
  });

  return { altw };
});

export default AltWModule;

// SPDX-License-Identifier: MIT
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ClearingHouseModule = buildModule("ClearingHouseModule", (m) => {
  const altTokenAddress = m.getParameter("altTokenAddress");
  const trusteeOwner = m.getParameter("trusteeOwner");

  const clearingHouse = m.contract("ClearingHouse", [
    altTokenAddress,
    trusteeOwner,
  ]);

  return { clearingHouse };
});

export default ClearingHouseModule;

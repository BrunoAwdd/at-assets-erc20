import { Metadata } from "next";
import ClearingHouseClient from "./client";
import { contracts } from "@/app/contracts";

export const metadata: Metadata = {
  title: "ATL-CH",
  description: "ATL-CH",
};

export default function ClearingHousePage() {
  return (
    <ClearingHouseClient
      clearingHouseContracts={contracts.ch}
      tokenContracts={contracts.altw}
    />
  );
}

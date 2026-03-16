import bscTestNetAbi from "@/abi/deployments/bnb-testnet-deployment/artifacts/AltModule_Alt.json";
import deployedBscTestNetContracts from "@/abi/deployments/bnb-testnet-deployment/deployed_addresses.json";

import bscMainNetAbi from "@/abi/deployments/bnb-mainnet-deployment/artifacts/AltModule_Alt.json";
import deployedBscMainNetContracts from "@/abi/deployments/bnb-mainnet-deployment/deployed_addresses.json";
import { Abi } from "viem";

//import bscMainNetAbi2 from "@/abi/deployments/bnb-testnet-deployment/artifacts/AltModule_Alt.json";

export interface ContractDataInterface {
  address: string;
  abi: Abi;
}

export interface Token {
  bscTestnet: ContractDataInterface;
  bsc: ContractDataInterface;
}

export interface Contracts {
  [key: string]: Token;
}

export const contracts: Contracts = {
  alt: {
    bscTestnet: {
      address: deployedBscTestNetContracts["AltModule#Alt"],
      abi: bscTestNetAbi.abi as Abi,
    },
    bsc: {
      address: deployedBscMainNetContracts["AltModule#Alt"],
      abi: bscMainNetAbi.abi as Abi,
    },
  },
  alt1: {
    bscTestnet: {
      address: deployedBscTestNetContracts["Alt1Module#Alt1"],
      abi: bscTestNetAbi.abi as Abi,
    },
    bsc: {
      address: deployedBscMainNetContracts["Alt1Module#Alt1"],
      abi: bscMainNetAbi.abi as Abi,
    },
  },
};

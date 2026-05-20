import bscTestNetAbi from "@/abi/deployments/bnb-testnet-deployment/artifacts/AltModule_Alt.json";
import altWBscTestNetAbi from "@/abi/deployments/bnb-testnet-deployment/artifacts/AltWModule_AltW.json";
import deployedBscTestNetContracts from "@/abi/deployments/bnb-testnet-deployment/deployed_addresses.json";

import bscMainNetAbi from "@/abi/deployments/bnb-mainnet-deployment/artifacts/AltModule_Alt.json";
import altWBscMainNetAbi from "@/abi/deployments/bnb-mainnet-deployment/artifacts/AltWModule_AltW.json";
import deployedBscMainNetContracts from "@/abi/deployments/bnb-mainnet-deployment/deployed_addresses.json";

import saltMainNetAbi from "@/abi/deployments/bnb-mainnet-deployment/artifacts/SALTModule_SALT.json";
import saltTestNetAbi from "@/abi/deployments/bnb-testnet-deployment/artifacts/SALTModule_SALT.json";
import clearingHouseAbi from "@/abi/ClearingHouse.json";

//import salt1MainNetAbi from "@/abi/deployments/bnb-mainnet-deployment/artifacts/SALT1Module_SALT1.json";
//import salt1TestNetAbi from "@/abi/deployments/bnb-testnet-deployment/artifacts/SALT1Module_SALT1.json";

//import salttMainNetAbi from "@/abi/deployments/bnb-mainnet-deployment/artifacts/SALTTModule_SALTT.json";
//import salttTestNetAbi from "@/abi/deployments/bnb-testnet-deployment/artifacts/SALTTModule_SALTT.json";

import { Abi } from "viem";

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
  altw: {
    bscTestnet: {
      address: deployedBscTestNetContracts["AltWModule#AltW"],
      abi: altWBscTestNetAbi.abi as Abi,
    },
    bsc: {
      address: deployedBscMainNetContracts["AltWModule#AltW"],
      abi: altWBscMainNetAbi.abi as Abi,
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
  altt: {
    bscTestnet: {
      address: deployedBscTestNetContracts["AltTModule#AltT"],
      abi: bscTestNetAbi.abi as Abi,
    },
    bsc: {
      address: deployedBscMainNetContracts["AltTModule#AltT"],
      abi: bscMainNetAbi.abi as Abi,
    },
  },
  salt: {
    bscTestnet: {
      address: deployedBscTestNetContracts["SALTModule#SALT"],
      abi: saltTestNetAbi.abi as Abi,
    },
    bsc: {
      address: deployedBscMainNetContracts["SALTModule#SALT"],
      abi: saltMainNetAbi.abi as Abi,
    },
  },
  ch: {
    bscTestnet: {
      address: deployedBscTestNetContracts["ClearingHouseModule#ClearingHouse"],
      abi: clearingHouseAbi.abi as Abi,
    },
    bsc: {
      address: deployedBscMainNetContracts["ClearingHouseModule#ClearingHouse"],
      abi: clearingHouseAbi.abi as Abi,
    },
  },
  /*
  salt1: {
    bscTestnet: {
      address: deployedBscTestNetContracts["SALT1Module#SALT1"],
      abi: salt1TestNetAbi.abi as Abi,
    },
    bsc: {
      address: deployedBscMainNetContracts["SALT1Module#SALT1"],
      abi: salt1MainNetAbi.abi as Abi,
    },
  },
  saltt: {
    bscTestnet: {
      address: deployedBscTestNetContracts["SALTTModule#SALTT"],
      abi: salttTestNetAbi.abi as Abi,
    },
    bsc: {
      address: deployedBscMainNetContracts["SALTTModule#SALTT"],
      abi: salttMainNetAbi.abi as Abi,
    },
  },*/
};

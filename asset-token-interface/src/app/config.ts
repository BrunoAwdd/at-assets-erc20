import { http, createConfig } from "wagmi";
import { bsc, bscTestnet } from "wagmi/chains";

export const config = createConfig({
  chains: [bsc, bscTestnet],
  transports: {
    //[mainnet.id]: http(),
    //[sepolia.id]: http(),
    [bsc.id]: http(),
    [bscTestnet.id]: http(),
  },
});

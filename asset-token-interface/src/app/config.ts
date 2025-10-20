import { http, createConfig } from "wagmi";
import { bsc, bscTestnet } from "wagmi/chains";

export const config = createConfig({
  chains: [bsc, bscTestnet],
  transports: {
    [bsc.id]: http("https://bsc-dataseed.binance.org/"),
    [bscTestnet.id]: http("https://data-seed-prebsc-1-s1.binance.org:8545/"),
  },
});

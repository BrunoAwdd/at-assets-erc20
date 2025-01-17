import "./globals.css";
import { Inter } from "next/font/google";
import { Providers } from "./provider";
import "@rainbow-me/rainbowkit/styles.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "AssetToken Interface",
  description: "Interface para o contrato ERC20 AssetToken",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

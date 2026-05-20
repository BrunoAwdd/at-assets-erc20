import "./globals.css";
import { Providers } from "./provider";
import "@rainbow-me/rainbowkit/styles.css";

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
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

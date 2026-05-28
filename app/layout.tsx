import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "臺北市酒駕／毒駕／拒測累犯教育儀表板";
const description = "以臺北市政府公開 PDF 公告資料製作的交通安全教育與資料視覺化儀表板。";

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title,
  description,
  applicationName: title,
  keywords: ["臺北市", "交通安全", "酒駕", "毒駕", "拒測", "資料視覺化", "教育儀表板"],
  authors: [{ name: "Taipei Public Safety Dashboard" }],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title,
    description,
    type: "website",
    locale: "zh_TW",
    siteName: title,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#285a4d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4, Tiro_Devanagari_Sanskrit } from "next/font/google";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { DrawerProvider } from "@/components/verse/Drawer";
import { Overlays } from "@/components/layout/Overlays";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], axes: ["opsz"], variable: "--font-inter", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin", "latin-ext"], style: ["normal", "italic"], axes: ["opsz"], variable: "--font-source-serif", display: "swap" });
const tiro = Tiro_Devanagari_Sanskrit({ subsets: ["devanagari", "latin", "latin-ext"], weight: "400", style: ["normal", "italic"], variable: "--font-tiro", display: "swap" });

const SITE = process.env.NEXT_PUBLIC_SITE_URL;
export const metadata: Metadata = {
  ...(SITE ? { metadataBase: new URL(SITE) } : {}),
  title: { default: "UpaSārathi · The Upanishads as a living graph", template: "%s · UpaSārathi" },
  description:
    "Nine Principal Upanishads as a 3D knowledge graph you can explore and ask, with Devanagari, IAST, chant and Śaṅkara’s commentary; and a downloadable harness that tests whether AI answers choose the pleasant over the good.",
  applicationName: "UpaSārathi",
  icons: { icon: "/favicon.svg" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { color: "#0a0c0b" },
  ],
};

// Before first paint: the pinned theme (dark unless the reader chose light); capture mode for video (?capture=1, also ?theme=light|dark).
const boot = `try{var q=new URLSearchParams(location.search),d=document.documentElement,p=q.get('theme')||localStorage.getItem('upasarathi:theme');d.dataset.theme=p==='light'?'light':'dark';if(q.get('capture')==='1')d.dataset.capture='1'}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${inter.variable} ${serif.variable} ${tiro.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
      </head>
      <body>
        <DrawerProvider>
          <TopNav />
          <main className="min-h-[70vh]">{children}</main>
          <Footer />
          <Overlays />
        </DrawerProvider>
      </body>
    </html>
  );
}

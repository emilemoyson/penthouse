import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";


export const metadata: Metadata = {
  title: { default: "Emile", template: "%s · Emile" },
  description: "Personal dashboard: training, kitchen and the penthouse.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { color: "#08080a" },
  ],
};

// Inside the penthouse's full-view sheet (an iframe) pages drop their nav and background and stay dark.
const themeScript = `try{if(window.self!==window.top){document.documentElement.classList.add("embedded")}else if(localStorage.getItem("theme")==="light")document.documentElement.setAttribute("data-theme","light")}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}

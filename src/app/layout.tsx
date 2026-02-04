import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import LoggerProvider from "@/components/LoggerProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Centsible — Personal Finance Dashboard",
  description: "Track and categorize your bank transactions",
  icons: { icon: "/logo.png", apple: "/logo.png" },
};

const themeScript = `
(function(){
  var t = localStorage.getItem('theme');
  if (!t) {
    var m = document.cookie.match(/(?:^|; )theme=([^;]*)/);
    if (m) t = m[1];
  }
  if (t === 'dark') {
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 dark:bg-gray-950`}
      >
        <LoggerProvider>
          <Nav />
          <main className="max-w-7xl mx-auto px-3 py-4 sm:px-4 sm:py-6 pb-20 sm:pb-6">{children}</main>
        </LoggerProvider>
      </body>
    </html>
  );
}

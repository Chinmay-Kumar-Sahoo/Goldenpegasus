import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Toaster } from 'react-hot-toast';
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GoldenPegasus | IT Consulting & Database Management",
  description: "GoldenPegasus IT Consulting & Services LLC — A secure, role-based SaaS platform for managing employee, marketing, and client data with real-time updates.",
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://uhjcnfglspbcgtlwyckh.supabase.co";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href={supabaseUrl} />
        <link rel="dns-prefetch" href={supabaseUrl} />
      </head>
      <body
        className={`${inter.variable} antialiased bg-black text-white`}
      >
        <Script id="hydration-extension-attribute-cleanup" strategy="beforeInteractive">
          {`
            (function () {
              var attributes = ['fdprocessedid', 'data-new-gr-c-s-check-loaded', 'data-gr-ext-installed', 'cz-shortcut-listen'];
              function clean(root) {
                if (!root || !root.querySelectorAll) return;
                attributes.forEach(function (attr) {
                  if (root.removeAttribute) root.removeAttribute(attr);
                  root.querySelectorAll('[' + attr + ']').forEach(function (node) {
                    node.removeAttribute(attr);
                  });
                });
              }
              clean(document.documentElement);
              clean(document.body);
            })();
          `}
        </Script>
        <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid #2a2a2a' } }} />
        {children}
      </body>
    </html>
  );
}

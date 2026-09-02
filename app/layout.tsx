import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/context";
import { LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "SNK LIFE OS",
  description: "Executive Command Center",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07110d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieLocale = cookies().get(LOCALE_COOKIE)?.value;
  const initialLocale: Locale = isLocale(cookieLocale) ? cookieLocale : "th";

  return (
    <html lang={initialLocale} className="dark">
      <body className="min-h-screen bg-bg text-ink font-sans antialiased">
        <I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>
      </body>
    </html>
  );
}

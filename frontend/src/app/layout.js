import { Fraunces, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "react-hot-toast";
import PageViewTracker from "@/components/analytics/PageViewTracker";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata = {
  title: "VoyAgent — Editorial AI Travel Planner",
  description:
    "Describe your Trip in natural language. Three specialist agents plan stays, flights, day-by-day itineraries, and an interactive Trip Map within your INR Budget.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${jakarta.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased bg-[#FAF8F4] text-[#181411] selection:bg-[#FCEEE8] selection:text-[#B54320]">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3200,
            style: {
              background: "#FFFFFF",
              color: "#181411",
              border: "1px solid #E7E0D5",
              borderRadius: "14px",
              fontSize: "13px",
              fontWeight: 500,
              padding: "12px 16px",
              boxShadow: "0 10px 30px -10px rgba(24, 20, 17, 0.14)",
            },
            success: {
              iconTheme: { primary: "#15803D", secondary: "#FFFFFF" },
            },
            error: {
              iconTheme: { primary: "#C82828", secondary: "#FFFFFF" },
            },
          }}
        />
        {children}
        {/* Cookie-free page-view counts: evidence of outside use for the project ceiling. */}
        <Analytics />
        <PageViewTracker />
      </body>
    </html>
  );
}

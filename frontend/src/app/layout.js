import "./globals.css";

export const metadata = {
  title: "VoyAgent",
  description: "AI-powered travel planning",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


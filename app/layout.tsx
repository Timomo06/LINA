// app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "LINA",
  description: "Learning Intelligent Network Assistant",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}

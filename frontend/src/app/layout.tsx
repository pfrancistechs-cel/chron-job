import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChronJob | Distributed Durable Timing Wheel Scheduler",
  description: "High-throughput delayed job scheduler with Hierarchical Hashed Timing Wheel, worker lease fencing, and DLQ replay.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#070912] text-slate-100 antialiased selection:bg-orange-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}


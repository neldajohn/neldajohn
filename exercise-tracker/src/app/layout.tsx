import type { Metadata } from "next";
import { Quicksand, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WorkoutProvider } from "@/context/WorkoutContext";
import NavBar from "@/components/NavBar";

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nelda's Strength Tracker",
  description: "A pink & grey personal exercise tracker — weeks, sets, reps, RPE and progress.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${quicksand.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <WorkoutProvider>
          <NavBar />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
          <footer className="border-t border-pink-100 py-4 text-center text-xs text-gray-400">
            Made with 🩷 for Nelda&apos;s training log
          </footer>
        </WorkoutProvider>
      </body>
    </html>
  );
}

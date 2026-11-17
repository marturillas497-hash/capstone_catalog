import "./globals.css";
import { cookies } from "next/headers";
import { EmbeddingProvider } from "@/components/shared/EmbeddingProvider";
import { ThemeSync } from "@/components/shared/ThemeSync";

export const metadata = {
  title: "MIST Topic Compass",
  description:
    "Check your research topic against the completed studies of Makilala Institute of Science and Technology, with similarity detection and AI advice.",
};

export default async function RootLayout({ children }) {
  // The middleware stores the user's program code in a cookie. Reading it here
  // puts the right colors in the first paint on a full page load.
  const cookieStore = await cookies();
  const raw = cookieStore.get("tc-program")?.value;
  const program = raw && /^[A-Z]{2,6}$/.test(raw) ? raw : undefined;

  return (
    <html lang="en" data-program={program} suppressHydrationWarning>
      <body>
        <ThemeSync />
        <EmbeddingProvider>
          {children}
        </EmbeddingProvider>
      </body>
    </html>
  );
}

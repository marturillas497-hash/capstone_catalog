import "./globals.css";
import { EmbeddingProvider } from "@/components/shared/EmbeddingProvider";

export const metadata = {
  title: "Capstone Library | MIST BSIS",
  description:
    "Web-Based Capstone Studies with Similarity Detection and AI Recommendation — Makilala Institute of Science and Technology",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <EmbeddingProvider>
          {children}
        </EmbeddingProvider>
      </body>
    </html>
  );
}

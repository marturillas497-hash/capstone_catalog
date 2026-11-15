import "./globals.css";
import { EmbeddingProvider } from "@/components/shared/EmbeddingProvider";

export const metadata = {
  title: "MIST Topic Compass",
  description:
    "Check your research topic against the completed studies of Makilala Institute of Science and Technology, with similarity detection and AI advice.",
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

"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

const EmbeddingContext = createContext(null);

export function EmbeddingProvider({ children }) {
  const pipelineRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadModel() {
      if (pipelineRef.current) return;
      setIsLoading(true);

      try {
        // Use require-style access to avoid Turbopack ESM interop issues
        const mod = await import("@xenova/transformers").then((m) => m.default ?? m);

        const pipeline = mod.pipeline ?? mod;
        const env = mod.env;

        if (env) {
          env.allowLocalModels = false;
        }

        const pipe = await pipeline(
          "feature-extraction",
          "Xenova/all-MiniLM-L6-v2"
        );

        if (!cancelled) {
          pipelineRef.current = pipe;
          setIsReady(true);
        }
      } catch (err) {
        console.error("Failed to load embedding model:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadModel();

    return () => {
      cancelled = true;
    };
  }, []);

  async function getEmbedding(text) {
    if (!pipelineRef.current) {
      throw new Error("Embedding model is not ready yet.");
    }

    const output = await pipelineRef.current(text, {
      pooling: "mean",
      normalize: true,
    });

    return Array.from(output.data);
  }

  return (
    <EmbeddingContext.Provider value={{ isReady, isLoading, getEmbedding }}>
      {children}
    </EmbeddingContext.Provider>
  );
}

export function useEmbedding() {
  const ctx = useContext(EmbeddingContext);
  if (!ctx) throw new Error("useEmbedding must be used inside EmbeddingProvider");
  return ctx;
}
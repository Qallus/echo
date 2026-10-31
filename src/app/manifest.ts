import type { MetadataRoute } from "next";

// Lets Echo be installed as an app (Add to Home Screen / Install app).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Echo",
    short_name: "Echo",
    description: "Record, transcribe and act on every call and meeting.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

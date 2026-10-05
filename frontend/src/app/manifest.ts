import type { MetadataRoute } from "next";

/** Lets phones "add to home screen" with the proper name and icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ΑΛΛΟΥ — Travel beyond the finish lines",
    short_name: "ΑΛΛΟΥ",
    start_url: "/",
    display: "standalone",
    background_color: "#E6E6E6",
    theme_color: "#E6E6E6",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

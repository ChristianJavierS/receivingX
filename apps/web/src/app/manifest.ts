import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ReceivingX",
    short_name: "ReceivingX",
    description: "AM/PM package receiving",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0A2340",
    icons: [
      {
        src: "/favicon/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/favicon/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}

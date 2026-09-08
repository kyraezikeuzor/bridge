import type { Config } from "tailwindcss";
import { sunrisePreset } from "@omelora/sunrise/tailwind-preset";

const config: Config = {
  // Sunrise ships readonly token tuples; cast for Tailwind's mutable Config type
  presets: [sunrisePreset as unknown as NonNullable<Config["presets"]>[number]],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/styles/**/*.{js,ts,jsx,tsx,mdx}",
    // Scan Sunrise components so their utility classes are generated
    "./node_modules/@omelora/sunrise/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Bridge interaction tokens use the product blue for app actions.
      colors: {
        bridge: {
          action: {
            DEFAULT: "#1aa1ff",
            hover: "#178fdb",
            soft: "#EEF8FF",
          },
        },
        primary: {
          DEFAULT: "#1aa1ff",
          foreground: "#FFFFFF",
        },
        ring: "#1aa1ff",
        sunrise: {
          600: "#178fdb",
        },
      },
    },
  },
  plugins: [],
};

export default config;

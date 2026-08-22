import type { Config } from "tailwindcss";
import { sunrisePreset } from "@omelora/sunrise/tailwind-preset";

const config: Config = {
  // Sunrise ships readonly token tuples; cast for Tailwind's mutable Config type
  presets: [sunrisePreset as unknown as NonNullable<Config["presets"]>[number]],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // Scan Sunrise components so their utility classes are generated
    "./node_modules/@omelora/sunrise/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;

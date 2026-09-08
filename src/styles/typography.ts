/**
 * Bridge's semantic type scale. Keep presentation decisions here so screens
 * describe the role of their copy instead of choosing one-off font utilities.
 * Font family intentionally comes from the Sunrise preset used by the app.
 */
export const typography = {
  pageTitle: "text-3xl font-semibold leading-tight tracking-tight sm:text-4xl",
  sectionTitle: "text-xl font-semibold leading-snug tracking-tight",
  cardTitle: "text-base font-semibold leading-snug tracking-normal",
  body: "text-base font-normal leading-relaxed tracking-normal",
  bodySmall: "text-sm font-normal leading-relaxed tracking-normal",
  label: "text-sm font-medium leading-none tracking-normal",
  metadata: "text-sm font-normal leading-normal tracking-normal",
  helper: "text-xs font-normal leading-normal tracking-normal",
  button: "text-sm font-medium leading-none tracking-normal",
  buttonSecondary: "border border-border bg-[#F8F8F8] text-foreground hover:bg-[#F0F0F0]",
  buttonPrimary: "bg-bridge-action text-white hover:bg-bridge-action-hover",
  buttonActionQuiet: "bg-bridge-action-soft text-bridge-action-hover hover:bg-bridge-action/20",
  status: "text-xs font-medium leading-none tracking-wide",
} as const;

/** Semantic foreground colors, mapped to the existing Sunrise color system. */
export const textColor = {
  primary: "text-foreground",
  card: "text-[#4A4A4A]",
  secondary: "text-muted-foreground",
  muted: "text-muted-foreground",
  subtle: "text-muted-foreground/70",
} as const;

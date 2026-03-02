export type ThemeTokens = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  ring: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
};

export type BrandNavItem = {
  labelKey: string;
  href: string;
  icon?: string; // lucide icon key
  badgeKey?: string;
  external?: boolean;
  adminOnly?: boolean;
};

export type BrandNavGroup = {
  labelKey?: string;
  items: BrandNavItem[];
};

export type BrandConfig = {
  name: string;
  logo: {
    full: string;
    icon: string;
    altKey?: string;
  };
  typography: {
    fontSans: string; // CSS font-family value
    fontMono: string; // CSS font-family value
  };
  urls?: {
    marketingHome?: string;
    appHome?: string;
    terms?: string;
    privacy?: string;
    support?: string;
  };
  nav: {
    marketing: BrandNavItem[]; // anchors on landing
    app: BrandNavGroup[]; // sidebar
    userMenu: BrandNavItem[]; // dropdown
  };
  theme: {
    radius: {
      sm: string;
      md: string;
      lg: string;
    };
    light: ThemeTokens;
    dark: ThemeTokens;
  };
};

export const brand: BrandConfig = {
  name: "StorageHo",
  logo: {
    full: "/brand/logo.svg",
    icon: "/brand/icon.svg",
    altKey: "brand.logoAlt",
  },
  typography: {
    fontSans:
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'",
    fontMono:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
  urls: {
    marketingHome: "/",
    appHome: "/dashboard",
    terms: "/terms",
    privacy: "/privacy",
    support: "/support",
  },
  nav: {
    marketing: [
      { labelKey: "nav.features", href: "#features" },
      { labelKey: "nav.pricing", href: "#pricing" },
      { labelKey: "nav.support", href: "/support" },
    ],
    app: [
      {
        labelKey: "nav.group.main",
        items: [
          {
            labelKey: "nav.dashboard",
            href: "/dashboard",
            icon: "LayoutDashboard",
          },
          {
            labelKey: "nav.canvas",
            href: "/canvas",
            icon: "Map",
          },
          {
            labelKey: "nav.scan",
            href: "/scan",
            icon: "ScanLine",
          },
          {
            labelKey: "nav.items",
            href: "/items",
            icon: "Package",
          },
          {
            labelKey: "nav.import",
            href: "/import",
            icon: "FileUp",
          },
          {
            labelKey: "nav.export",
            href: "/export",
            icon: "FileDown",
          },
        ],
      },
      {
        labelKey: "nav.group.profile",
        items: [
          { labelKey: "nav.account", href: "/profile/account", icon: "User" },
          {
            labelKey: "nav.subscription",
            href: "/profile/subscription",
            icon: "CreditCard",
          },
          {
            labelKey: "nav.admin",
            href: "/admin",
            icon: "ShieldCheck",
            adminOnly: true,
          },
        ],
      },
    ],
    userMenu: [
      { labelKey: "userMenu.profile", href: "/profile/account", icon: "User" },
      { labelKey: "userMenu.signOut", href: "/logout", icon: "LogOut" },
    ],
  },
  theme: {
    radius: {
      sm: "0.5rem",
      md: "0.75rem",
      lg: "1rem",
    },
    // HSL channels (shadcn style)
    light: {
      // Paper base
      background: "145 25% 98%",
      foreground: "222 47% 11%",

      // Surfaces
      card: "0 0% 100%",
      cardForeground: "222 47% 11%",
      popover: "0 0% 100%",
      popoverForeground: "222 47% 11%",

      // Subtle teal-tinted neutrals
      muted: "165 18% 94%",
      mutedForeground: "215 14% 34%",

      border: "165 12% 87%",
      input: "165 12% 83%",

      // Brand: deep storage teal
      primary: "170 59% 30%",
      primaryForeground: "0 0% 98%",
      ring: "170 59% 30%",

      secondary: "165 18% 95%",
      secondaryForeground: "222 47% 11%",

      accent: "168 20% 91%",
      accentForeground: "222 47% 11%",

      destructive: "0 84% 60%",
      destructiveForeground: "0 0% 98%",
    },
    dark: {
      background: "222 47% 6%",
      foreground: "210 40% 98%",

      card: "222 47% 8%",
      cardForeground: "210 40% 98%",
      popover: "222 47% 8%",
      popoverForeground: "210 40% 98%",

      // Dark teal neutrals
      muted: "170 16% 14%",
      mutedForeground: "215 18% 70%",

      border: "170 14% 16%",
      input: "170 14% 16%",

      // Brighter teal for contrast
      primary: "170 52% 56%",
      primaryForeground: "170 30% 8%",
      ring: "170 52% 56%",

      secondary: "170 16% 14%",
      secondaryForeground: "210 40% 98%",

      accent: "170 16% 14%",
      accentForeground: "210 40% 98%",

      destructive: "0 63% 31%",
      destructiveForeground: "210 40% 98%",
    },
  },
} as const;


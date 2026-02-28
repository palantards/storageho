import {
  LayoutDashboard,
  User,
  CreditCard,
  LogOut,
  Menu,
  Sun,
  Moon,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  BookOpen,
  ShieldCheck,
  MapPin,
  Package,
  FileUp,
  FileDown,
} from "lucide-react";

export const icons = {
  LayoutDashboard,
  User,
  CreditCard,
  LogOut,
  Menu,
  Sun,
  Moon,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  BookOpen,
  ShieldCheck,
  MapPin,
  Package,
  FileUp,
  FileDown,
} as const;

export type IconKey = keyof typeof icons;

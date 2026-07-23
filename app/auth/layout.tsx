import { ClerkRoot } from "@/components/providers/ClerkRoot";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <ClerkRoot>{children}</ClerkRoot>;
}

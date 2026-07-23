import { ClerkRoot } from "@/components/providers/ClerkRoot";

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return <ClerkRoot>{children}</ClerkRoot>;
}

import { createHash } from "crypto";
import { bridgeStore as rootStore } from "./store";

export function bridgeStore() {
  return rootStore();
}

export function sha256FromStore(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

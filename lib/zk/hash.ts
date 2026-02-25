export async function sha256Hex(value: string): Promise<string> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("Web Crypto API is only available in browser runtime");
  }

  const bytes = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

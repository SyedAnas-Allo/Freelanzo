/** Dicebear PNG — SVG often fails to paint in iOS WKWebView / Radix Avatar. */
export function dicebearAvatarUrl(seed: string) {
  const value = encodeURIComponent(seed.trim() || "Freelanzo");
  return `https://api.dicebear.com/9.x/avataaars/png?size=256&seed=${value}`;
}

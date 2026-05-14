export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return v;
}

export function getPrivateKey(): string {
  const key = requireEnv("GOOGLE_PRIVATE_KEY");
  return key.replace(/\\n/g, "\n");
}

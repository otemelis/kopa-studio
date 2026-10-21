#!/usr/bin/env node

import { createPrivateKey, randomUUID, sign } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, values) => {
  if (value.startsWith("--")) pairs.push([value.slice(2), values[index + 1]]);
  return pairs;
}, []));
const required = ["client-id", "team-id", "key-id", "private-key", "out"];
const missing = required.filter((key) => !args[key]);
if (missing.length) {
  console.error(`Missing: ${missing.map((key) => `--${key}`).join(", ")}`);
  console.error("Usage: node scripts/generate-apple-ads-client-secret.mjs --client-id SEARCHADS... --team-id SEARCHADS... --key-id UUID --private-key /secure/path/private-key.pem --out /secure/path/apple-ads-client-secret.txt");
  process.exit(1);
}

const now = Math.floor(Date.now() / 1000);
const base64url = (value) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
const header = base64url({ alg: "ES256", kid: args["key-id"], typ: "JWT" });
const payload = base64url({ iss: args["team-id"], iat: now, exp: now + 179 * 24 * 60 * 60, aud: "https://appleid.apple.com", sub: args["client-id"], jti: randomUUID() });
const privateKey = createPrivateKey(await readFile(args["private-key"]));
const signature = sign("sha256", Buffer.from(`${header}.${payload}`), { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");
await writeFile(args.out, `${header}.${payload}.${signature}\n`, { mode: 0o600 });
console.log(`Client secret written to ${args.out}. Keep this file private; it expires in 179 days.`);

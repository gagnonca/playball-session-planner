// Makes the "Secret Key (for OAuth)" Supabase needs for Sign in with Apple.
// Runs locally; the .p8 key and the output never leave this machine.
//
//   node scripts/apple-client-secret.mjs <AuthKey_XXXX.p8> <TEAM_ID> <KEY_ID> <SERVICES_ID> | pbcopy
//
// The secret (a JWT signed with the key) is copied to the clipboard; paste it
// into Supabase → Authentication → Sign In / Providers → Apple → Secret Key.
// Apple caps it at 6 months: re-run this before the date printed below.
import { readFileSync } from 'node:fs';
import { createPrivateKey, sign } from 'node:crypto';

const [p8Path, teamId, keyId, servicesId] = process.argv.slice(2);
if (!p8Path || !teamId || !keyId || !servicesId) {
  console.error('usage: node scripts/apple-client-secret.mjs <AuthKey_XXXX.p8> <TEAM_ID> <KEY_ID> <SERVICES_ID>');
  process.exit(1);
}

const b64url = (x) => Buffer.from(x).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const exp = now + 180 * 24 * 60 * 60; // 180 days (Apple's max is ~182.6)

const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
const claims = b64url(JSON.stringify({ iss: teamId, iat: now, exp, aud: 'https://appleid.apple.com', sub: servicesId }));
const signature = sign('sha256', Buffer.from(`${header}.${claims}`), {
  key: createPrivateKey(readFileSync(p8Path)),
  dsaEncoding: 'ieee-p1363', // JWT ES256 wants raw r||s, not DER
});

process.stdout.write(`${header}.${claims}.${b64url(signature)}`);
console.error(`Apple client secret created. It expires ${new Date(exp * 1000).toDateString()} — put a reminder before then.`);

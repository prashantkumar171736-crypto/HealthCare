This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Admin Security

Email OTP is disabled by default. Configure Resend and the common variables in Vercel before enabling it from the Admin Dashboard's Security tab:

```text
RESEND_API_KEY
RESEND_FROM
ADMIN_OTP_EMAIL
OTP_HMAC_SECRET
IP_RATE_LIMIT_SECRET
ADMIN_LOGIN_PATH
```

The About page links to a high-entropy admin path by default. You can optionally override it with `ADMIN_LOGIN_PATH`, set to a single path segment containing at least 32 URL-safe characters; configure the override before building and use the same value in local and Vercel environments. Direct requests to `/admin/login` return 404. The path is an additional obscurity measure and does not replace password, session, or OTP authentication.

Verify the sending domain with Resend, set `RESEND_FROM` to an address on that verified domain, and set `ADMIN_OTP_EMAIL` to the destination inbox. Admin email is sent through Resend's HTTPS API.

`ADMIN_OTP_EMAIL` is the operator-managed destination for admin verification codes. SMS delivery is not enabled. Login protection uses five failed password attempts in a 15-minute window, followed by a 30-minute block. Active counters and blocks are stored in MongoDB using keyed IP fingerprints; raw visitor IPs are no longer written to new analytics records or returned in admin logs.

Use **Send test email** in the Admin Dashboard's Security settings to confirm the configured provider accepts a message to `ADMIN_OTP_EMAIL` before enabling OTP. If login email delivery fails, the login form reports a safe diagnostic for common authentication, connectivity, or sender/recipient errors. Update the corresponding environment variables in Vercel and redeploy; changing local `.env.local` does not update the deployed app.

IP archiving is optional and uses a separate private R2 bucket, not the public uploads bucket. Configure `R2_SECURITY_ACCOUNT_ID`, `R2_SECURITY_ACCESS_KEY_ID`, `R2_SECURITY_SECRET_ACCESS_KEY`, `R2_SECURITY_BUCKET_NAME`, and `R2_SECURITY_ENCRYPTION_KEY` to enable it. The R2 token should be scoped to that bucket; configure bucket lifecycle expiration to match your retention policy. The encryption key must be 32 random bytes encoded as 64 hex characters (generate with `openssl rand -hex 32`) and stored separately from R2. Losing the key makes archived data unrecoverable.

To remove raw IPs and pseudonymize reversible legacy visitor IDs in existing analytics records, and clear the legacy raw-IP GeoIP cache, back up MongoDB first. The script requires `IP_RATE_LIMIT_SECRET` and defaults to a count-only dry run. `--archive` uploads raw-IP analytics and cache documents as batched, gzip-compressed, AES-256-GCM encrypted Extended JSON to `ip-archive/`; `--archive --apply` completes all archive uploads before changing MongoDB. Archive failures stop cleanup. `--archive` without `--apply` uploads an archive but leaves MongoDB unchanged.

```bash
npm run analytics:ip-cleanup
npm run analytics:ip-cleanup -- --archive --apply
```

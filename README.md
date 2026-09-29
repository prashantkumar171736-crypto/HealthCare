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

Email OTP is disabled by default. Configure these server-only variables in Vercel before enabling it from the Admin Dashboard's Security tab:

```text
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
SMTP_FROM
ADMIN_OTP_EMAIL
OTP_HMAC_SECRET
IP_RATE_LIMIT_SECRET
```

`ADMIN_OTP_EMAIL` is the operator-managed destination for admin verification codes. SMS delivery is not enabled. Login protection uses five failed password attempts in a 15-minute window, followed by a 30-minute block. Active counters and blocks are stored in MongoDB using keyed IP fingerprints; raw visitor IPs are no longer written to new analytics records or returned in admin logs.

The `R2_SECURITY_*` bucket is not used by this release because raw-IP archiving is disabled. Analytics remain in MongoDB with IP fields removed; no IP archive is written to R2.

To remove raw IPs and pseudonymize reversible legacy visitor IDs in existing analytics records, and clear the legacy raw-IP GeoIP cache, back up MongoDB first. The script requires `IP_RATE_LIMIT_SECRET`, defaults to a count-only dry run, and only writes with `-- --apply`:

```bash
npm run analytics:ip-cleanup
npm run analytics:ip-cleanup -- --apply
```

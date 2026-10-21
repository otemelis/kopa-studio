# Apple Ads Lab setup

1. In Apple Ads, have an account administrator invite a dedicated API user with the least-privileged read-only access suitable for reporting and account discovery.
2. Follow Apple’s OAuth documentation to create a key pair, upload the public key, obtain the Apple Ads client ID, and generate the signed client-secret JWT.
3. Generate the client secret locally with `scripts/generate-apple-ads-client-secret.mjs`, then put only `APPLE_ADS_CLIENT_ID` and `APPLE_ADS_CLIENT_SECRET` in the server deployment secret store. Do not place them in `NEXT_PUBLIC_*`, source control, browser storage or logs.
4. Apply the Milestone 1 migration and deploy the tools app.
5. Open Apple Ads Lab and run the read-only connection check. Confirm the returned organization deliberately before storing a mapping.
6. Map each Apple `adamId` to a unique `aso_apps` record and verify currency and timezone.

Apple tokens are requested with client credentials and cached only in process memory before expiry. This first implementation has no write credentials, and the API adapter contains no mutation capability.

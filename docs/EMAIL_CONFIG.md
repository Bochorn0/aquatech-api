# Email configuration – where it’s used and what to set

The API sends **password reset** and **metric alert** emails. They **will work** once you add credentials (see below).

---

## Quick start: make emails work (e.g. on Azure)

**Right now** emails are off because no credentials are set. To turn them on:

1. **Azure App Service** → your API app → **Configuration** → **Application settings**.
2. Add **one** of these sets of settings (then **Save** and **Restart** the app).

**Easiest on Azure (SMTP is often blocked): SendGrid**

| Name | Value |
|------|--------|
| `SENDGRID_API_KEY` | Your key from [SendGrid](https://sendgrid.com) (free tier is enough) |
| `SENDGRID_FROM_EMAIL` | e.g. `soporte@lcc.com.mx` (must be verified in SendGrid or your domain) |

You do **not** need to set `EMAIL_PROVIDER`; the app detects SendGrid when it sees `SENDGRID_API_KEY`.

**Alternative: SMTP (Office 365 / Gmail)**

| Name | Value |
|------|--------|
| `EMAIL_PROVIDER` | `smtp` |
| `SMTP_HOST` | `smtp.office365.com` (or `smtp.gmail.com`) |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Your sending address |
| `SMTP_PASSWORD` | Password or app password |

After saving and restarting, check the app logs: you should see either `[EmailHelper] Using SendGrid API` or `[EmailHelper] Email transporter initialized`. Then try “Forgot password” again.

---

| Feature | When | Uses |
|--------|------|------|
| **Password reset** | User requests “forgot password” | `sendPasswordResetEmail` |
| **Metric alerts** | An alert rule fires (e.g. TDS out of range) and “email” is enabled for that alert | `sendAlertEmail` |

So if you want those to work, you need **one** of the configs below. The warning you saw (`Required: SMTP_USER, OAUTH_CLIENT_ID...`) is for **SMTP with OAuth2** only; you can use a different option.

---

## Option A – SMTP with password (simplest)

Use this when the sending mailbox uses a normal password or an **app password** (e.g. Gmail app password).

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=soporte@lcc.com.mx
SMTP_PASSWORD=your_password_or_app_password
```

- **Office 365 / Outlook:** `SMTP_HOST=smtp.office365.com`, port 587.
- **Gmail:** `SMTP_HOST=smtp.gmail.com`, use an [App Password](https://support.google.com/accounts/answer/185833) if 2FA is on.
- **Your own server:** e.g. `SMTP_HOST=mail.lcc.com.mx` (or whatever your host gives you).

No `OAUTH_*` or `SMTP_AUTH_TYPE` needed.

**If you get “535 5.7.3 Authentication unsuccessful” with Office 365 / Outlook:**  
Microsoft often disables SMTP username/password (basic auth) for Exchange/Outlook. You have two options:

1. **Use OAuth2** (Option B below): set `SMTP_AUTH_TYPE=oauth2` and get a refresh token with `node scripts/get-oauth-refresh-token.js`, then set `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `OAUTH_REFRESH_TOKEN` in app settings.
2. **Use SendGrid (recommended):** skip SMTP and set only `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL`. No Outlook auth needed and it works from Azure.

---

## Option B – SMTP with OAuth2 (2FA / Microsoft 365)

Use this when the mailbox has 2FA and you can’t use an app password, or you prefer OAuth (e.g. Microsoft 365).

```env
EMAIL_PROVIDER=smtp
SMTP_AUTH_TYPE=oauth2
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=soporte@lcc.com.mx
OAUTH_CLIENT_ID=...
OAUTH_CLIENT_SECRET=...
OAUTH_REFRESH_TOKEN=...
```

You get the refresh token once with:

```bash
node scripts/get-oauth-refresh-token.js
```

Then add the printed values to `.env` or Azure App Settings. This is the **only** case that needs `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `OAUTH_REFRESH_TOKEN` (and the warning you saw).

---

## Option C – SendGrid / Mailgun / Resend (no SMTP ports)

Use these if your host blocks SMTP or you prefer an API. Only **one** provider is used; set `EMAIL_PROVIDER` and that provider’s keys.

**SendGrid:**

```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=soporte@lcc.com.mx
```

**Mailgun:**

```env
EMAIL_PROVIDER=mailgun
MAILGUN_API_KEY=...
MAILGUN_DOMAIN=lcc.com.mx
MAILGUN_FROM_EMAIL=soporte@lcc.com.mx
```

**Resend:**

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=soporte@lcc.com.mx
```

No SMTP or OAuth vars needed for these.

---

## Summary

- **Yes**, the app uses this config for **password reset** and **metric alert** emails.
- You only need **one** of: **SMTP (password)**, **SMTP (OAuth2)**, **SendGrid**, **Mailgun**, or **Resend**.
- The “Required: SMTP_USER, OAUTH_CLIENT_ID…” message is **only** for **Option B** (SMTP + OAuth2). If you use Option A (password) or C (SendGrid/Mailgun/Resend), you don’t set those OAuth vars and that warning won’t apply once the right provider and keys are set.

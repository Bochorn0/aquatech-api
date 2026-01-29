# Email Branding Update - TI Water

All email templates have been updated from "Aquatech" to "TI Water" branding.

## Changes Made:

✅ **Branding Updates:**
- All "Aquatech" references changed to "TI Water"
- Email subjects updated
- Email headers updated
- Email footers updated

✅ **URL Updates:**
- Default FRONTEND_URL changed from `http://localhost:3000` to `https://www.lcc.com.mx`
- Password reset links now use production URL

## Update Your .env File:

Make sure your `.env` has the production frontend URL:

```env
FRONTEND_URL=https://www.lcc.com.mx
```

**Note:** The code will use `https://www.lcc.com.mx` as default if `FRONTEND_URL` is not set, but it's better to set it explicitly.

## Email Templates Updated:

1. **Password Reset Email** - Now shows "TI Water" branding
2. **Alert Email** - Now shows "TI Water - Alerta del Sistema"
3. **Notification Email** - Now shows "TI Water" branding
4. **From Name** - Default changed to "TI Water" (can be overridden with `MAILGUN_FROM_NAME`)

## After Updating .env:

Restart your server to apply changes:

```bash
pm2 restart 0 --update-env
```

## Test:

Send a test password reset email and verify:
- ✅ Branding shows "TI Water"
- ✅ Reset link uses `https://www.lcc.com.mx/reset-password?token=...`
- ✅ Footer shows "© 2026 TI Water. Todos los derechos reservados."

# Deploying Email Notifications to Supabase

## Prerequisites

1. **Supabase CLI** installed
2. **Resend API Key** (or other email provider)
3. **Supabase project** configured

---

## Step 1: Install Supabase CLI

```bash
# Windows (PowerShell)
scoop install supabase

# Or use npm
npm install -g supabase
```

---

## Step 2: Login to Supabase

```bash
supabase login
```

---

## Step 3: Link Project

```bash
cd c:\Users\Administrator\Documents\AuditCB
supabase link --project-ref [YOUR_PROJECT_REF]
```

Find your project ref at: `https://supabase.com/dashboard/project/[PROJECT_REF]`

---

## Step 4: Get Resend API Key

1. Go to https://resend.com
2. Sign up for free account
3. Create API key
4. Copy the key

---

## Step 5: Set Secrets

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
```

---

## Step 6: Deploy Edge Function

```bash
supabase functions deploy send-email
```

---

## Step 7: Test Edge Function

```bash
curl -L -X POST 'https://[PROJECT_REF].supabase.co/functions/v1/send-email' \
  -H 'Authorization: Bearer [YOUR_ANON_KEY]' \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "user_invitation",
    "to": "test@example.com",
    "data": {
      "full_name": "Test User",
      "role": "Auditor",
      "confirmation_url": "https://audit.companycertification.com"
    }
  }'
```

---

## Alternative: Without Supabase CLI

If you don't want to use CLI, you can:

1. Copy the `send-email/index.ts` file content
2. Go to Supabase Dashboard → Edge Functions
3. Create new function named `send-email`
4. Paste the code
5. Add `RESEND_API_KEY` in the Secrets section
6. Deploy

---

## Verification

After deployment:

1. Go to your app
2. Settings → Users → Invite User
3. Enter a test email
4. Click "Send Invitation"
5. Check if email arrives

---

## Troubleshooting

### Email not sending

- Check Supabase logs: `supabase functions logs send-email`
- Verify `RESEND_API_KEY` is set correctly
- Check Resend dashboard for API errors

### Function not found

- Verify deployment: `supabase functions list`
- Redeploy: `supabase functions deploy send-email --no-verify-jwt`

### CORS errors

- Edge Function already has CORS headers
- If still issues, check Supabase project CORS settings

---

## Production Checklist

- [ ] Resend API key configured
- [ ] Edge Function deployed
- [ ] Test email delivery
- [ ] Configure custom domain in Resend
- [ ] Set up SPF/DKIM records
- [ ] Test all 4 email types
- [ ] Monitor email logs

---

**Note**: The email service will work even without Edge Function deployment - it will just log the emails instead of sending them.

# Authentication Setup Guide - Golden Pegasus

## Overview

This guide explains the authentication system for Golden Pegasus, including signup, password reset, and email verification flows. It addresses common issues like token errors, PKCE errors, and invalid links.

## Quick Start

### 1. Environment Setup

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000  # or your production URL
```

### 2. Supabase Email Template Configuration (CRITICAL)

This step is **required** to prevent token consumption and enable proper authentication flow.

#### Go to Supabase Dashboard:

1. Navigate to **Authentication** → **Email Templates**
2. Update both templates as shown below

#### Confirmation Email Template

Replace the entire template content with:

```
<h2>Confirm your signup</h2>

<p>Follow this link to confirm your email:</p>

<p><a href="{{ .SiteURL }}/auth/verify?token_hash={{ .TokenHash }}&type=signup&next=/dashboard">Confirm your email</a></p>
```

#### Password Reset Email Template

Replace the entire template content with:

```
<h2>Reset your password</h2>

<p>Follow this link to reset your password:</p>

<p><a href="{{ .SiteURL }}/auth/verify?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Reset password</a></p>
```

**Why this matters:**

- ✅ Uses `{{ .TokenHash }}` instead of `{{ .ConfirmationURL }}` to prevent email security scanners from consuming tokens
- ✅ Routes through `/auth/verify` for proper token validation
- ✅ Supports cross-browser and incognito mode usage
- ✅ Prevents token reuse attacks

### 3. Enable Email Confirmation Requirement

1. In Supabase Dashboard → **Authentication** → **Providers**
2. Find **Email** section
3. Enable **Confirm email** (checkbox)
4. This ensures users must verify their email before logging in

## Authentication Flows

### Flow 1: User Signup

```
User → /signup (enter email, password, name)
        ↓
    Supabase creates account
    ↓
    Sends confirmation email with token_hash
    ↓
Email link → /auth/verify?token_hash=...&type=signup
    ↓
/auth/verify exchanges token_hash
    ↓
User logged in automatically → /dashboard
```

**What can go wrong and how we fixed it:**

- ❌ **OLD**: Email scanner consumes token before user clicks
  - ✅ **NEW**: token_hash prevents scanner access
- ❌ **OLD**: Token doesn't work in different browser
  - ✅ **NEW**: token_hash is browser-independent
- ❌ **OLD**: Double-clicking link burns token
  - ✅ **NEW**: Module-level `isVerifying` flag prevents double execution

### Flow 2: Password Reset

```
User → /forgot-password (enter email)
        ↓
    Supabase sends recovery email
    ↓
Email link → /auth/verify?token_hash=...&type=recovery
    ↓
/auth/verify verifies token
    ↓
    Sets recovery_verified flag
    ↓
Redirect → /reset-password
    ↓
User enters new password
    ↓
Password updated and user signed out
    ↓
Redirect → /login with success message
```

### Flow 3: Login After Signup

```
User already verified email
    ↓
    Go to /login
    ↓
    Enter email + password
    ↓
    System checks email_confirmed_at
    ↓
    Login successful → /dashboard
```

## File Changes Made

### 1. `/src/app/auth/verify/page.tsx` (UPDATED)

- Proper token_hash validation
- Support for both token_hash and code exchange
- Recovery type handling
- Better error messages
- Prevents double verification

### 2. `/src/app/reset-password/page.tsx` (UPDATED)

- Uses recovery_verified flag from verify page
- Proper session checking
- Better error handling
- Password update with session cleanup

### 3. `/src/app/forgot-password/page.tsx` (UPDATED)

- Changed from auto-submit to form-based flow
- Allows users to enter email manually
- Better email validation
- Resend link capability

### 4. `/src/app/signup/page.tsx` (UPDATED)

- Added signup_email to localStorage
- OTP verification support
- Fallback type handling ('signup' → 'email')
- Better error messages

### 5. `/next.config.mjs` (UPDATED)

- Added redirect rules for auth callbacks
- Cache control headers for auth routes

### 6. `.env.example` (NEW)

- Complete environment documentation
- Email template requirements
- Authentication flow documentation

## Troubleshooting

### Issue: "Token error" or "Invalid token"

**Causes:**

1. Supabase email template still using `{{ .ConfirmationURL }}`
2. Token already consumed by email scanner
3. Token expired (24-hour limit)
4. Token used twice (from double-click)

**Solutions:**

1. ✅ Update Supabase email templates (see above)
2. ✅ User should request new link
3. ✅ Links expire after 24 hours, request new one
4. ✅ Already handled - module-level flag prevents double verification

### Issue: "Invalid link" on password reset

**Causes:**

1. Copied link to different browser/incognito
2. Recovery email template not using token_hash
3. Using old recovery URL format

**Solutions:**

1. ✅ Now works - token_hash is browser-independent
2. ✅ Update email template as shown above
3. ✅ Links now use `/auth/verify` route

### Issue: "No active session" on password reset

**Causes:**

1. User accessed /reset-password without going through email link
2. Session expired
3. recovery_verified flag not set

**Solutions:**

1. ✅ Redirect user to /forgot-password to request new link
2. ✅ Auto-prompts to request new link
3. ✅ localStorage flag properly set and checked

### Issue: PKCE-related errors

**Causes:**

1. Code exchange failure due to missing cookies
2. Redirect URL mismatch
3. Cross-site requests

**Solutions:**

1. ✅ Uses token_hash instead of code exchange for email flows
2. ✅ Configured in next.config.mjs
3. ✅ Proper SameSite=lax cookie configuration

## Email Verification for Existing Users

If you have existing users who signed up without email confirmation:

### Option 1: Enable Email Confirmation

1. Go to Supabase Dashboard → **Authentication** → **Providers**
2. Enable **Confirm email** requirement
3. Existing unconfirmed users will be prompted to verify

### Option 2: Manual Verification

Run this query in Supabase SQL Editor:

```sql
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;
```

## Testing the Flow

### Test Signup:

1. Go to `http://localhost:3000/signup`
2. Fill in form
3. Check email for verification link
4. Click link (should redirect to /auth/verify, then /dashboard)
5. Check `/dashboard` to confirm logged in

### Test Password Reset:

1. Go to `http://localhost:3000/forgot-password`
2. Enter email
3. Check email for reset link
4. Click link (should redirect to /auth/verify, then /reset-password)
5. Enter new password
6. Should redirect to /login with success message

### Test Login:

1. Go to `http://localhost:3000/login`
2. Enter credentials
3. Should redirect to /dashboard

## Production Considerations

### Environment Variables:

```
# Update these for production
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Supabase Settings:

1. Enable custom SMTP if using production emails
2. Update email templates with your production domain
3. Review email rate limits
4. Configure recovery email settings

### Security:

1. Set `secure: true` for cookies in production (already configured)
2. Use HTTPS only
3. Monitor auth logs in Supabase dashboard
4. Set up email templates before going live

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Next.js + Supabase](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [PKCE Flow](https://oauth.net/2/pkce/)

## Support

For issues or questions:

1. Check the Troubleshooting section above
2. Review Supabase logs in Dashboard
3. Check browser console for JavaScript errors
4. Verify email templates are correctly configured

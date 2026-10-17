import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Only signed-in Admins and Certification Managers (public.is_admin_or_cert_manager(),
// which reads profiles.role) may send mail through this function. The JWT is
// verified here rather than relying on the platform's verify_jwt setting,
// because the deploy scripts use --no-verify-jwt.

const DEFAULT_ORIGINS = [
  'https://audit360.isoxpert.com',
  'https://audit-cb.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
]

// Extra origins can be added with: supabase secrets set ALLOWED_ORIGINS=https://a,https://b
const ALLOWED_ORIGINS = new Set([
  ...DEFAULT_ORIGINS,
  ...(Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map(s => s.trim()).filter(Boolean)
])

// The sender is fixed server-side; callers cannot choose it.
// Override with: supabase secrets set EMAIL_FROM="AuditCB <noreply@yourdomain>"
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'AuditCB <onboarding@resend.dev>'

const EMAIL_TYPES = new Set(['user_invitation', 'audit_assignment', 'report_approval', 'certificate_issued'])
const URL_FIELDS = new Set(['confirmation_url', 'redirect_url', 'audit_url', 'report_url', 'certificate_url'])
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/

interface EmailRequest {
  type: 'user_invitation' | 'audit_assignment' | 'report_approval' | 'certificate_issued'
  to: string
  data: any
}

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  }
  if (ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' }
  })
}

/** The verified caller's user id when they are an Admin or Certification Manager, else null. */
async function authorizedSender(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!/^Bearer\s+\S+/i.test(authHeader)) return null

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false }
    }
  )

  const { data: userData, error: userError } = await supabaseUser.auth.getUser()
  if (userError || !userData?.user) return null

  const { data: allowed, error: rpcError } = await supabaseUser.rpc('is_admin_or_cert_manager')
  if (rpcError) {
    console.error('is_admin_or_cert_manager() check failed:', rpcError.message)
    return null
  }
  return allowed === true ? userData.user.id : null
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Template data with every string HTML-escaped and every link restricted to
 * http(s), so caller-supplied values cannot inject markup or javascript: links
 * into the email body.
 */
function sanitizeTemplateData(data: any): Record<string, string> {
  const out: Record<string, string> = {}
  if (!data || typeof data !== 'object') return out
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined || typeof value === 'object') continue
    const text = String(value)
    if (URL_FIELDS.has(key)) {
      try {
        const url = new URL(text)
        if (url.protocol === 'https:' || url.protocol === 'http:') out[key] = escapeHtml(url.href)
      } catch {
        // drop invalid URLs
      }
      continue
    }
    out[key] = escapeHtml(text)
  }
  return out
}

/** Subject lines are plain text: keep them single-line and bounded. */
function plainText(data: any): Record<string, string> {
  const out: Record<string, string> = {}
  if (!data || typeof data !== 'object') return out
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined || typeof value === 'object') continue
    out[key] = String(value).replace(/[\r\n]+/g, ' ').slice(0, 200)
  }
  return out
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeadersFor(req) })
  }

  if (req.method !== 'POST') {
    return json(req, { error: 'Method Not Allowed' }, 405)
  }

  try {
    const senderId = await authorizedSender(req)
    if (!senderId) {
      return json(req, { error: 'Not authorized to send email' }, 403)
    }

    const { type, to, data }: EmailRequest = await req.json()

    if (!to || !type) {
      return json(req, { error: 'Missing required fields: to, type' }, 400)
    }

    if (!EMAIL_TYPES.has(type)) {
      return json(req, { error: 'Unknown email type' }, 400)
    }

    if (typeof to !== 'string' || !EMAIL_RE.test(to.trim())) {
      return json(req, { error: 'Invalid recipient' }, 400)
    }

    // Get email template
    const emailContent = getEmailTemplate(type, sanitizeTemplateData(data), plainText(data))

    // Send email using Resend API
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured, email will be logged but not sent')
      console.log('Email would be sent:', { to, subject: emailContent.subject })

      return json(req, {
        success: true,
        message: 'Email logged (Resend not configured)',
        preview: emailContent.subject
      })
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: to.trim(),
        subject: emailContent.subject,
        html: emailContent.html,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('Resend error:', result?.message)
      return json(req, { error: 'Failed to send email' }, 502)
    }

    // Log email send to database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    await supabase.from('audit_log').insert({
      action: 'email_sent',
      user_id: senderId,
      details: {
        type: type,
        to: to.trim(),
        subject: emailContent.subject,
        email_id: result.id
      }
    })

    return json(req, {
      success: true,
      email_id: result.id,
      message: 'Email sent successfully'
    })

  } catch (error) {
    console.error('Email send error:', error)
    return json(req, { error: 'Failed to send email' }, 500)
  }
})

function getEmailTemplate(type: string, data: Record<string, string>, plain: Record<string, string>): { subject: string, html: string } {
  switch (type) {
    case 'user_invitation':
      return {
        subject: `Welcome to AuditCB - Complete Your Registration`,
        html: getUserInvitationTemplate(data)
      }

    case 'audit_assignment':
      return {
        subject: `New Audit Assignment: ${plain.client_name}`,
        html: getAuditAssignmentTemplate(data)
      }

    case 'report_approval':
      return {
        subject: `Report ${plain.status}: ${plain.client_name}`,
        html: getReportApprovalTemplate(data)
      }

    case 'certificate_issued':
      return {
        subject: `Certificate Issued: ${plain.client_name}`,
        html: getCertificateIssuedTemplate(data)
      }

    default:
      throw new Error(`Unknown email type: ${type}`)
  }
}

function getUserInvitationTemplate(data: any): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to AuditCB</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Welcome to AuditCB</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; opacity: 0.9;">Your Audit Management Platform</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 22px;">Hi ${data.full_name || 'there'},</h2>
              
              <p style="color: #666666; line-height: 1.6; margin: 0 0 20px 0;">
                You've been invited to join <strong>${data.organization || 'Company Certification'}</strong> on AuditCB. 
                Your account has been created with the role of <strong>${data.role}</strong>.
              </p>
              
              <p style="color: #666666; line-height: 1.6; margin: 0 0 30px 0;">
                To complete your registration and set your password, please click the button below:
              </p>
              
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 6px; padding: 0;">
                    <a href="${data.confirmation_url || data.redirect_url}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
                      Complete Registration
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${data.confirmation_url || data.redirect_url}" style="color: #667eea; word-break: break-all;">${data.confirmation_url || data.redirect_url}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #999999; font-size: 14px; margin: 0 0 10px 0;">
                <strong>AuditCB</strong> - Professional Audit Management
              </p>
              <p style="color: #999999; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Company Certification Body. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

function getAuditAssignmentTemplate(data: any): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Audit Assignment</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">New Audit Assignment</h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 22px;">Hi ${data.auditor_name},</h2>
              
              <p style="color: #666666; line-height: 1.6; margin: 0 0 20px 0;">
                You have been assigned to a new audit for <strong>${data.client_name}</strong>.
              </p>
              
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="background-color: #f8f9fa;">
                  <td style="padding: 12px; border: 1px solid #e9ecef; font-weight: 600; color: #495057;">Client:</td>
                  <td style="padding: 12px; border: 1px solid #e9ecef; color: #666666;">${data.client_name}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border: 1px solid #e9ecef; font-weight: 600; color: #495057;">Standard:</td>
                  <td style="padding: 12px; border: 1px solid #e9ecef; color: #666666;">${data.standard || 'N/A'}</td>
                </tr>
                <tr style="background-color: #f8f9fa;">
                  <td style="padding: 12px; border: 1px solid #e9ecef; font-weight: 600; color: #495057;">Scheduled Date:</td>
                  <td style="padding: 12px; border: 1px solid #e9ecef; color: #666666;">${data.scheduled_date || 'TBD'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border: 1px solid #e9ecef; font-weight: 600; color: #495057;">Your Role:</td>
                  <td style="padding: 12px; border: 1px solid #e9ecef; color: #666666;">${data.role || 'Auditor'}</td>
                </tr>
              </table>
              
              <table cellpadding="0" cellspacing="0" style="margin: 30px auto 0 auto;">
                <tr>
                  <td style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); border-radius: 6px; padding: 0;">
                    <a href="${data.audit_url || 'https://audit.companycert ification.com'}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
                      View Audit Details
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #999999; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Company Certification Body. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

function getReportApprovalTemplate(data: any): string {
  const statusColor = data.status === 'Approved' ? '#059669' : '#dc2626'

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Report ${data.status}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: ${statusColor}; padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Report ${data.status}</h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 22px;">Hi ${data.auditor_name},</h2>
              
              <p style="color: #666666; line-height: 1.6; margin: 0 0 20px 0;">
                Your audit report for <strong>${data.client_name}</strong> has been <strong style="color: ${statusColor};">${(data.status || '').toLowerCase()}</strong>.
              </p>
              
              ${data.comments ? `
              <div style="background-color: #f8f9fa; border-left: 4px solid ${statusColor}; padding: 15px; margin: 20px 0;">
                <p style="color: #666666; margin: 0; font-style: italic;">"${data.comments}"</p>
              </div>
              ` : ''}
              
              <table cellpadding="0" cellspacing="0" style="margin: 30px auto 0 auto;">
                <tr>
                  <td style="background-color: ${statusColor}; border-radius: 6px; padding: 0;">
                    <a href="${data.report_url || 'https://audit.companycertification.com'}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
                      View Report
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #999999; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Company Certification Body. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

function getCertificateIssuedTemplate(data: any): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate Issued</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🎓 Certificate Issued</h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 22px;">Congratulations!</h2>
              
              <p style="color: #666666; line-height: 1.6; margin: 0 0 20px 0;">
                A certificate has been issued to <strong>${data.client_name}</strong> for successfully completing the ${data.standard || 'certification'} audit.
              </p>
              
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="background-color: #fffbeb;">
                  <td style="padding: 12px; border: 1px solid #fde68a; font-weight: 600; color: #92400e;">Certificate Number:</td>
                  <td style="padding: 12px; border: 1px solid #fde68a; color: #92400e;">${data.certificate_number || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border: 1px solid #fde68a; font-weight: 600; color: #92400e;">Issue Date:</td>
                  <td style="padding: 12px; border: 1px solid #fde68a; color: #666666;">${data.issue_date || new Date().toLocaleDateString()}</td>
                </tr>
                <tr style="background-color: #fffbeb;">
                  <td style="padding: 12px; border: 1px solid #fde68a; font-weight: 600; color: #92400e;">Expiry Date:</td>
                  <td style="padding: 12px; border: 1px solid #fde68a; color: #666666;">${data.expiry_date || 'N/A'}</td>
                </tr>
              </table>
              
              <table cellpadding="0" cellspacing="0" style="margin: 30px auto 0 auto;">
                <tr>
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 6px; padding: 0;">
                    <a href="${data.certificate_url || 'https://audit.companycertification.com'}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
                      Download Certificate
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #999999; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Company Certification Body. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

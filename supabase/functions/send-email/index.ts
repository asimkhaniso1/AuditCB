import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
    type: 'user_invitation' | 'audit_assignment' | 'report_approval' | 'certificate_issued'
    to: string
    data: any
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { type, to, data }: EmailRequest = await req.json()

        if (!to || !type) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: to, type' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get email template
        const emailContent = getEmailTemplate(type, data)

        // Send email using Resend API
        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

        if (!RESEND_API_KEY) {
            console.warn('RESEND_API_KEY not configured, email will be logged but not sent')
            console.log('Email would be sent:', { to, subject: emailContent.subject })

            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'Email logged (Resend not configured)',
                    preview: emailContent.subject
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: data.from || 'AuditCB <notifications@companycertification.com>',
                to: to,
                subject: emailContent.subject,
                html: emailContent.html,
            }),
        })

        const result = await response.json()

        if (!response.ok) {
            throw new Error(result.message || 'Failed to send email')
        }

        // Log email send to database
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        await supabase.from('audit_log').insert({
            action: 'email_sent',
            user_id: data.user_id || null,
            details: {
                type: type,
                to: to,
                subject: emailContent.subject,
                email_id: result.id
            }
        })

        return new Response(
            JSON.stringify({
                success: true,
                email_id: result.id,
                message: 'Email sent successfully'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Email send error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

function getEmailTemplate(type: string, data: any): { subject: string, html: string } {
    switch (type) {
        case 'user_invitation':
            return {
                subject: `Welcome to AuditCB - Complete Your Registration`,
                html: getUserInvitationTemplate(data)
            }

        case 'audit_assignment':
            return {
                subject: `New Audit Assignment: ${data.client_name}`,
                html: getAuditAssignmentTemplate(data)
            }

        case 'report_approval':
            return {
                subject: `Report ${data.status}: ${data.client_name}`,
                html: getReportApprovalTemplate(data)
            }

        case 'certificate_issued':
            return {
                subject: `Certificate Issued: ${data.client_name}`,
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
                Your audit report for <strong>${data.client_name}</strong> has been <strong style="color: ${statusColor};">${data.status.toLowerCase()}</strong>.
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

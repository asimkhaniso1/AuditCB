// Vercel Serverless Function - Send Email via SMTP
// Environment Variables Required:
// - SMTP_HOST: mail.companycertification.com
// - SMTP_PORT: 587
// - SMTP_USER: info@companycertification.com
// - SMTP_PASS: your_email_password

const nodemailer = require('nodemailer');

// Create reusable transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.companycertification.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    tls: {
        rejectUnauthorized: false // Allow self-signed certificates (common on shared hosting)
    }
});

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { to, subject, html, from, replyTo } = req.body;

        // Validate required fields
        if (!to || !subject || !html) {
            return res.status(400).json({
                error: 'Missing required fields: to, subject, html'
            });
        }

        // Send email
        const info = await transporter.sendMail({
            from: from || `AuditCB360 <${process.env.SMTP_USER}>`,
            to: to,
            replyTo: replyTo || process.env.SMTP_USER,
            subject: subject,
            html: html
        });

        console.log('Email sent:', info.messageId);

        return res.status(200).json({
            success: true,
            messageId: info.messageId,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Email error:', error);
        return res.status(500).json({
            error: 'Failed to send email',
            details: error.message
        });
    }
};

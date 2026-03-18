// ============================================================
//  AAYAM '26 — Campus Ambassador Registration
//  Vercel Serverless Function: /api/register.js
// ============================================================

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore }                 = require("firebase-admin/firestore");
const nodemailer                       = require("nodemailer");

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const data = req.body;

    if (!data.fullname || !data.email || !data.phone || !data.college) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    // ── Save to Firestore ─────────────────────────────────────
    await db.collection("ca-registrations").add({
      fullname:    data.fullname   || "",
      email:       data.email      || "",
      phone:       data.phone      || "",
      gender:      data.gender     || "",
      college:     data.college    || "",
      course:      data.course     || "",
      year:        data.year       || "",
      city:        data.city       || "",
      linkedin:    data.linkedin   || "",
      instagram:   data.instagram  || "",
      why:         data.why        || "",
      experience:  data.experience || "",
      submittedAt: new Date().toISOString(),
    });

    // ── Send email — failure will NOT affect the user ─────────
    // Fire and forget — we don't await this
    sendConfirmationEmail(data).catch(err => {
      console.error("Email failed (non-blocking):", err.message);
    });

    // ── Always return success if Firestore saved ──────────────
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

async function sendConfirmationEmail(data) {
  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; color: #1a1a1a;">
      <div style="background: #0d0d1a; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #a78bfa; margin: 0; font-size: 22px; letter-spacing: 2px;">AAYAM '26</h1>
        <p style="color: #888; margin: 4px 0 0; font-size: 12px;">Campus Ambassador Programme</p>
      </div>
      <div style="background: #f9f9f9; padding: 32px; border-radius: 0 0 8px 8px;">
        <h2 style="color: #0d0d1a; font-size: 18px;">Application Received! ✓</h2>
        <p>Hi <strong>${data.fullname}</strong>,</p>
        <p>Thank you for applying to the <strong>AAYAM '26 Campus Ambassador Programme</strong>!</p>
        <p>We've received your application and our team will review it shortly.</p>
        <div style="background: #ede9fe; border-left: 4px solid #7c3aed; padding: 16px 20px; border-radius: 4px; margin: 24px 0;">
          <p style="margin: 0 0 8px; font-size: 13px; color: #555; text-transform: uppercase; letter-spacing: 1px;">Application Summary</p>
          <table style="font-size: 14px; width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 4px 0; color: #555; width: 100px;">Name</td>    <td><strong>${data.fullname}</strong></td></tr>
            <tr><td style="padding: 4px 0; color: #555;">College</td> <td><strong>${data.college}</strong></td></tr>
            <tr><td style="padding: 4px 0; color: #555;">Course</td>  <td><strong>${data.course} (Year ${data.year})</strong></td></tr>
            <tr><td style="padding: 4px 0; color: #555;">City</td>    <td><strong>${data.city}</strong></td></tr>
          </table>
        </div>
        <p style="font-size: 13px; color: #888;">If you have any questions, reply to this email.</p>
        <p style="margin-bottom: 0;">Regards,<br><strong>Team AAYAM '26</strong> | NST</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from:    `"Team AAYAM '26" <${process.env.SMTP_USER}>`,
    to:      data.email,
    subject: "✅ AAYAM '26 — Campus Ambassador Application Received!",
    text:    `Hi ${data.fullname}, your application has been received! We'll review it and get back to you soon. - Team AAYAM '26`,
    html:    htmlBody,
    replyTo: process.env.SMTP_USER,
  });
}
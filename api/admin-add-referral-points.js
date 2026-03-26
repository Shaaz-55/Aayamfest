// ============================================================
//  AAYAM '26 — Admin Add Referral Points
//  Vercel Serverless Function: /api/admin-add-referral-points.js
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

const POINTS_PER_REFERRAL = 20;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    // Verify admin password
    const adminPassword = req.headers.authorization;
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { caDocId, caCode, caName, caEmail, registrationCount, note } = req.body;

    if (!caDocId || !caCode || !registrationCount || registrationCount < 1) {
      return res.status(400).json({ success: false, error: "Missing or invalid fields" });
    }

    const pointsToAdd  = Number(registrationCount) * POINTS_PER_REFERRAL;
    const caRef        = db.collection("ca-registrations").doc(caDocId);
    const caSnap       = await caRef.get();

    if (!caSnap.exists) {
      return res.status(404).json({ success: false, error: "CA not found" });
    }

    const currentPoints    = Number(caSnap.data().totalPoints)    || 0;
    const currentReferrals = Number(caSnap.data().totalReferrals) || 0;

    // Update CA document — add points + track referral count
    await caRef.update({
      totalPoints:    currentPoints    + pointsToAdd,
      totalReferrals: currentReferrals + Number(registrationCount),
    });

    // Log referral batch for audit trail
    await db.collection("ca-referrals").add({
      caDocId,
      caCode,
      caName,
      caEmail,
      registrationCount: Number(registrationCount),
      pointsAwarded:     pointsToAdd,
      pointsPerReg:      POINTS_PER_REFERRAL,
      note:              note || "",
      addedAt:           new Date().toISOString(),
    });

    // Send email to CA (non-blocking)
    sendReferralEmail({ caEmail, caName, registrationCount, pointsToAdd })
      .catch(e => console.error("Referral email failed:", e));

    return res.status(200).json({
      success: true,
      pointsAdded: pointsToAdd,
      newTotal: currentPoints + pointsToAdd,
    });

  } catch (err) {
    console.error("Referral points error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

async function sendReferralEmail({ caEmail, caName, registrationCount, pointsToAdd }) {
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
        <h2 style="color: #0d0d1a; font-size: 18px;">🎉 Referral Points Credited!</h2>
        <p>Hi <strong>${caName}</strong>,</p>
        <p>Great work bringing people to AAYAM '26! Your referral points have been updated.</p>
        <div style="background: #ede9fe; border-left: 4px solid #7c3aed; padding: 16px 20px; border-radius: 4px; margin: 24px 0;">
          <table style="font-size: 14px; width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 4px 0; color: #555; width: 180px;">Registrations Counted</td><td><strong>${registrationCount}</strong></td></tr>
            <tr><td style="padding: 4px 0; color: #555;">Points per Registration</td><td><strong>20 pts</strong></td></tr>
            <tr><td style="padding: 4px 0; color: #555;">Total Points Credited</td>
              <td><span style="background:#22c55e; color:#fff; padding:3px 8px; border-radius:4px; font-weight:bold;">+ ${pointsToAdd} pts</span></td>
            </tr>
          </table>
        </div>
        <p>Keep spreading the word — every registration counts!</p>
        <p><a href="https://www.aayamfest.com/ca-dashboard.html" style="color:#7c3aed;">View your Dashboard →</a></p>
        <p style="margin-bottom: 0;">Regards,<br><strong>Team AAYAM '26</strong> | NST</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from:    `"Team AAYAM '26" <${process.env.SMTP_USER}>`,
    to:      caEmail,
    subject: `🎉 AAYAM '26 — +${pointsToAdd} Referral Points Credited!`,
    html:    htmlBody,
    replyTo: process.env.SMTP_USER,
  });
}

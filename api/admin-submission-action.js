// ============================================================
//  AAYAM '26 — Admin Submission Action
//  Vercel Serverless Function: /api/admin-submission-action.js
// ============================================================

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const nodemailer = require("nodemailer");

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
    storageBucket: process.env.FIREBASE_PROJECT_ID + ".firebasestorage.app",
  });
}

const db = getFirestore();
const storage = getStorage();

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const adminPassword = req.headers.authorization;
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { action, submissionDocId, caDocId, caEmail, caName, taskType, points, adminNote } = req.body;

    if (!action || !submissionDocId || !caDocId) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const subRef = db.collection("ca-submissions").doc(submissionDocId);
    const caRef = db.collection("ca-registrations").doc(caDocId);
    const subSnap = await subRef.get();

    if (!subSnap.exists) {
      return res.status(404).json({ success: false, error: "Submission not found" });
    }

    const subData = subSnap.data();
    const storagePath = subData.storagePath || "";
    const timestamp = new Date().toISOString();

    if (action === "approve") {
      const awardedPoints = Number(points);

      // 1. Update submission
      await subRef.update({
        status: "approved",
        pointsAwarded: awardedPoints,
        adminNote: adminNote || "",
        reviewedAt: timestamp,
        storagePath: "",           // Clear path after deletion
      });

      // 2. Add points to CA
      const caSnap = await caRef.get();
      if (caSnap.exists) {
        const current = Number(caSnap.data().totalPoints) || 0;
        await caRef.update({ totalPoints: current + awardedPoints });
      }

      // 3. Delete image from Storage (fire and forget)
      deleteFromStorage(storagePath);

      // 4. Send email
      sendTaskEmail({ action: "approved", email: caEmail, fullname: caName, taskType, points: awardedPoints, note: adminNote })
        .catch(e => console.error("Email failed:", e));

      return res.status(200).json({ success: true, message: "Submission approved" });

    } else if (action === "reject") {

      // 1. Update submission
      await subRef.update({
        status: "rejected",
        adminNote: adminNote || "",
        reviewedAt: timestamp,
        storagePath: "",             // Clear path after deletion
      });

      // 2. Delete image from Storage (fire and forget)
      deleteFromStorage(storagePath);

      // 3. Send email
      sendTaskEmail({ action: "rejected", email: caEmail, fullname: caName, taskType, note: adminNote })
        .catch(e => console.error("Email failed:", e));

      return res.status(200).json({ success: true, message: "Submission rejected" });

    } else {
      return res.status(400).json({ success: false, error: "Invalid action" });
    }

  } catch (err) {
    console.error("Admin submission action error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Delete file from Firebase Storage ────────────────────────
async function deleteFromStorage(storagePath) {
  if (!storagePath) return; // Skip for URL-only submissions (links)
  try {
    await storage.bucket().file(storagePath).delete();
    console.log("Deleted from storage:", storagePath);
  } catch (e) {
    // File may already be deleted or path wrong — non-blocking
    console.error("Storage delete failed (non-blocking):", e.message);
  }
}

// ── Confirmation Email ────────────────────────────────────────
async function sendTaskEmail({ action, email, fullname, taskType, points, note }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  let subject, mainMessage;

  if (action === "approved") {
    subject = `✅ AAYAM '26 — Task Approved (+ ${points} pts)`;
    mainMessage = `<p>Great news! Your <strong>${taskType}</strong> submission was approved.</p>
                   <p><span style="background:#22c55e; color:#fff; padding:4px 8px; border-radius:4px; font-weight:bold;">+ ${points} points</span> have been added to your profile.</p>`;
  } else {
    subject = `❌ AAYAM '26 — Task Needs Revision`;
    mainMessage = `<p>Your <strong>${taskType}</strong> submission was unfortunately rejected.</p>
                   <p>Please review the feedback and resubmit from your portal.</p>`;
  }

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; color: #1a1a1a;">
      <div style="background: #0d0d1a; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #a78bfa; margin: 0; font-size: 22px; letter-spacing: 2px;">AAYAM '26</h1>
      </div>
      <div style="background: #f9f9f9; padding: 32px; border-radius: 0 0 8px 8px;">
        <p>Hi <strong>${fullname}</strong>,</p>
        ${mainMessage}
        ${note ? `<div style="background:#fff; border:1px solid #ddd; padding:16px; border-radius:6px; margin:20px 0;"><h4 style="margin:0 0 8px;color:#555;">Feedback:</h4><p style="margin:0;font-style:italic;">"${note}"</p></div>` : ""}
        <p><a href="https://www.aayamfest.com/ca-dashboard.html" style="color:#7c3aed;">Go to CA Dashboard →</a></p>
        <p style="margin-bottom:0;">Keep up the good work,<br><strong>Team AAYAM '26</strong> | NST</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Team AAYAM '26" <${process.env.SMTP_USER}>`,
    to: email,
    subject,
    html: htmlBody,
    replyTo: process.env.SMTP_USER,
  });
}
// ============================================================
//  AAYAM '26 — Admin Action (Approve / Reject CAs)
//  Vercel Serverless Function: /api/admin-action.js
// ============================================================

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const nodemailer = require("nodemailer");

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();
const auth = getAuth();

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

    const { action, docId, email, fullname, college } = req.body;

    if (!action || !docId || !email || !fullname) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const docRef = db.collection("ca-registrations").doc(docId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }

    if (action === "approve") {
      // 1. Generate unique CA Code logic
      // Simplest auto-generated could just be timestamp or random, but the requirement: "AAYAM-CA-XX (auto-incremented)".
      // Let's count approved documents
      const snapshot = await db.collection("ca-registrations").where("status", "==", "approved").count().get();
      const count = snapshot.data().count + 1;
      const caCode = `AAYAM-CA-${count.toString().padStart(3, '0')}`;

      // 2. Update Firestore
      await docRef.update({
        status: 'approved',
        caCode: caCode,
        approvedAt: new Date().toISOString()
      });

      // 3. Create Firebase Auth User
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(email);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          userRecord = await auth.createUser({
            email: email,
            emailVerified: true,
            displayName: fullname
          });
        } else {
          throw error;
        }
      }

      // 4. Generate Password Reset Link
      const resetLink = await auth.generatePasswordResetLink(email);

      // 5. Send Welcome Email via Nodemailer
      await sendWelcomeEmail({ fullname, email, caCode, resetLink });

      return res.status(200).json({ success: true, message: "Approved successfully", caCode });

    } else if (action === "reject") {
      // 1. Update Firestore
      await docRef.update({
        status: 'rejected',
        rejectedAt: new Date().toISOString()
      });

      // 2. Send Rejection Email via Nodemailer
      await sendRejectionEmail({ fullname, email });

      return res.status(200).json({ success: true, message: "Rejected successfully" });
    } else {
      return res.status(400).json({ success: false, error: "Invalid action" });
    }

  } catch (err) {
    console.error("Admin action error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

async function sendWelcomeEmail(data) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
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
        <h2 style="color: #0d0d1a; font-size: 18px;">🎉 You're Selected!</h2>
        <p>Hi <strong>${data.fullname}</strong>,</p>
        <p>Congratulations! You have been selected as an <strong>AAYAM '26 Campus Ambassador</strong>.</p>
        
        <div style="background: #ede9fe; border-left: 4px solid #7c3aed; padding: 16px 20px; border-radius: 4px; margin: 24px 0;">
          <p style="margin: 0 0 8px; font-size: 13px; color: #555; text-transform: uppercase;">Your Unique CA Code</p>
          <div style="font-size: 24px; font-weight: bold; color: #7c3aed; letter-spacing: 2px;">${data.caCode}</div>
        </div>

        <h3>Next Steps:</h3>
        <p>1. <strong>Set your password:</strong> Click the link below to set your account password.</p>
        <p><a href="${data.resetLink}" style="display:inline-block; padding: 10px 20px; background-color: #7c3aed; color: #ffffff; text-decoration: none; border-radius: 4px;">Set Password</a></p>
        
        <p>2. <strong>Login to the CA Portal:</strong> After setting your password, use your email and password to log in.</p>
        <p><a href="https://aayamfest-theta.vercel.app/ca-portal.html" style="color: #7c3aed;">Go to CA Portal</a> (Replace with actual deployment link if different)</p>

        <h3>Tasks to Earn Points:</h3>
        <ul style="color: #555;">
          <li>Instagram Reel (50 pts)</li>
          <li>Instagram Story (20 pts)</li>
          <li>LinkedIn Post (30 pts)</li>
          <li>Twitter/X Post (20 pts)</li>
          <li>Campus Poster (25 pts)</li>
          <li>WhatsApp Group Promo (15 pts)</li>
        </ul>
        
        <p style="font-size: 13px; color: #888;">If you have any questions, reply to this email.</p>
        <p style="margin-bottom: 0;">Welcome aboard,<br><strong>Team AAYAM '26</strong> | NST</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Team AAYAM '26" <${process.env.SMTP_USER}>`,
    to: data.email,
    subject: "🎉 You're Selected! AAYAM '26 Campus Ambassador",
    html: htmlBody,
    replyTo: process.env.SMTP_USER,
  });
}

async function sendRejectionEmail(data) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
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
      </div>
      <div style="background: #f9f9f9; padding: 32px; border-radius: 0 0 8px 8px;">
        <p>Hi <strong>${data.fullname}</strong>,</p>
        <p>Thank you for your interest in the AAYAM '26 Campus Ambassador Programme.</p>
        <p>Unfortunately, we are unable to accept your application at this time due to the high volume of highly competitive applicants.</p>
        <p>We encourage you to still participate in the fest and its various competitions.</p>
        <p style="margin-bottom: 0;">Regards,<br><strong>Team AAYAM '26</strong> | NST</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Team AAYAM '26" <${process.env.SMTP_USER}>`,
    to: data.email,
    subject: "AAYAM '26 — Campus Ambassador Application Status",
    html: htmlBody,
    replyTo: process.env.SMTP_USER,
  });
}

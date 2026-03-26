// ============================================================
//  AAYAM '26 — Admin Referral History
//  Vercel Serverless Function: /api/admin-referral-history.js
// ============================================================

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore }                 = require("firebase-admin/firestore");

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
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const adminPassword = req.headers.authorization;
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const snap = await db.collection("ca-referrals")
      .orderBy("addedAt", "desc")
      .limit(200)
      .get();

    const history = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return res.status(200).json({ success: true, history });

  } catch (err) {
    console.error("Referral history error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ============================================================
//  AAYAM '26 — Fetch Leaderboard
//  Vercel Serverless Function: /api/leaderboard.js
// ============================================================

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore }                 = require("firebase-admin/firestore");
const { getAuth }                      = require("firebase-admin/auth");

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
const auth = getAuth();

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Unauthorized: Missing Token" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    try {
      await auth.verifyIdToken(idToken);
    } catch (e) {
      return res.status(401).json({ success: false, error: "Unauthorized: Invalid Token" });
    }

    // Fetch all approved CAs
    const snapshot = await db.collection("ca-registrations")
      .where("status", "==", "approved")
      .get();

    let cas = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      cas.push({
        name: data.fullname,
        college: data.college,
        caCode: data.caCode,
        totalPoints: Number(data.totalPoints) || 0
      });
    });

    // Sort descending by points
    cas.sort((a, b) => b.totalPoints - a.totalPoints);

    // Assign rank
    let currentRank = 1;
    cas.forEach((ca, index) => {
      // Handle ties conceptually if needed, but for now simple positional rank
      if (index > 0 && ca.totalPoints < cas[index-1].totalPoints) {
        currentRank = index + 1;
      }
      ca.rank = currentRank;
      
      // Determine tier
      let tier = "Bronze";
      if (ca.totalPoints >= 500) tier = "Platinum";
      else if (ca.totalPoints >= 250) tier = "Gold";
      else if (ca.totalPoints >= 100) tier = "Silver";
      
      ca.tier = tier;
    });

    return res.status(200).json({ success: true, leaderboard: cas });
  } catch (err) {
    console.error("Leaderboard error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

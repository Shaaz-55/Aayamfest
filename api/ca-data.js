// ============================================================
//  AAYAM '26 — Fetch CA Profile and Submissions
//  Vercel Serverless Function: /api/ca-data.js
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
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (e) {
      return res.status(401).json({ success: false, error: "Unauthorized: Invalid Token" });
    }

    const email = decodedToken.email;

    // Fetch CA Profile
    const profileSnap = await db.collection("ca-registrations")
      .where("email", "==", email)
      .where("status", "==", "approved")
      .limit(1)
      .get();

    if (profileSnap.empty) {
      return res.status(404).json({ success: false, error: "CA Profile not found or not approved." });
    }

    const profileDoc = profileSnap.docs[0];
    const profile = { id: profileDoc.id, ...profileDoc.data() };

    // Fetch CA Submissions (using caCode to filter)
    const submissionsSnap = await db.collection("ca-submissions")
      .where("caCode", "==", profile.caCode)
      .orderBy("submittedAt", "desc")
      .get();

    const submissions = [];
    submissionsSnap.forEach(doc => {
      submissions.push({ id: doc.id, ...doc.data() });
    });

    return res.status(200).json({ success: true, profile, submissions });
  } catch (err) {
    console.error("CA Data error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

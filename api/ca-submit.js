// ============================================================
//  AAYAM '26 — CA Task Submit
//  Vercel Serverless Function: /api/ca-submit.js
// ============================================================

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

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

    // submissionData = download URL (for images) or plain URL (for links)
    // storagePath    = Firebase Storage path (only for image uploads, empty for links)
    const { caCode, caName, taskType, points, submissionData, storagePath } = req.body;

    if (!caCode || !caName || !taskType || !submissionData) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    // Verify CA exists and email matches
    const caSnap = await db.collection("ca-registrations")
      .where("email", "==", email)
      .where("caCode", "==", caCode)
      .limit(1)
      .get();

    if (caSnap.empty) {
      return res.status(403).json({ success: false, error: "Forbidden: CA Profile mismatch" });
    }

    const caDocId = caSnap.docs[0].id;

    const submissionObj = {
      caEmail: email,
      caName,
      caCode,
      caDocId,
      taskType,
      points: Number(points),
      submissionData, // Download URL or link URL
      storagePath: storagePath || "", // Firebase Storage path for deletion later
      status: "pending",
      submittedAt: new Date().toISOString(),
    };

    const docRef = await db.collection("ca-submissions").add(submissionObj);

    return res.status(200).json({ success: true, submissionId: docRef.id });

  } catch (err) {
    console.error("CA Submit error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
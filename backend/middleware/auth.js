import { getAuth } from "firebase-admin/auth";
import User from "../models/User.js";

export const verifyFirebaseToken = async (req, res, next) => {
  // Pass through browser CORS preflight OPTIONS requests without checking for tokens
  if (req.method === "OPTIONS") {
    return next();
  }

  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  const idToken = authorization.split("Bearer ")[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    req.user = decodedToken;

    const dbUser = await User.findOne({ uid: decodedToken.uid });
    if (dbUser) {
      req.user.role = dbUser.role;
    } else {
      req.user.role = decodedToken.role || 'employee';
    }

    next();
  } catch (error) {
    console.error("Firebase token verification failed:", error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

export const requireRole =
  (...allowedRoles) =>
  (req, res, next) => {
    const role = req.user?.role;
    if (!role) {
      return res.status(403).json({ error: "Role claim missing from token" });
    }
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: "Insufficient privileges" });
    }
    next();
  };

export const requireAnyRole = (...allowedRoles) => requireRole(...allowedRoles);

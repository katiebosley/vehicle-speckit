import db from "../models/index.js";
import logger from "../config/logger.js";

export const getBearerToken = (req) => {
  const [scheme, token] = (req.get("authorization") ?? "").split(" ");
  return scheme === "Bearer" && token ? token : null;
};

export const authenticate = async (req, res, next) => {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).send({ message: "Unauthorized! No session token provided." });
  }

  try {
    const session = await db.session.findOne({
      where: { token },
      include: [{ model: db.user, as: "user" }],
    });

    if (!session || session.expirationDate < new Date() || !session.user?.isActive) {
      return res.status(401).send({ message: "Unauthorized! Session is invalid or expired." });
    }

    req.user = { id: session.user.id, role: session.user.role, email: session.user.email };
    return next();
  } catch (err) {
    logger.error(`authenticate failed: ${err.message}`);
    return res.status(500).send({ message: "Could not verify session." });
  }
};

export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).send({ message: "You do not have permission for this action." });
    }
    return next();
  };

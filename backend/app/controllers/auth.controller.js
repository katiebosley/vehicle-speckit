import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { Op } from "sequelize";
import db from "../models/index.js";
import authConfig from "../config/auth.config.js";
import logger from "../config/logger.js";
import { getBearerToken } from "../authorization/authorization.js";

const User = db.user;
const Session = db.session;
const googleClient = new OAuth2Client();

const exports = {};

const verifyGoogleCredential = async (credential) => {
  if (!credential || typeof credential !== "string") {
    return null;
  }

  if (!authConfig.googleClientId) {
    logger.error("GOOGLE_CLIENT_ID is not set; refusing Google sign-in.");
    return null;
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: authConfig.googleClientId,
    });
    const payload = ticket.getPayload();
    return payload?.sub && payload?.email ? payload : null;
  } catch (err) {
    logger.warn(`Google credential rejected: ${err.message}`);
    return null;
  }
};

const findOrCreateUser = async (payload) => {
  const email = payload.email.trim().toLowerCase();

  const byGoogleId = await User.findOne({ where: { googleId: payload.sub } });
  if (byGoogleId) {
    return byGoogleId;
  }

  const byEmail = await User.findOne({ where: { email } });
  if (byEmail) {
    await byEmail.update({ googleId: payload.sub });
    return byEmail;
  }

  return User.create({
    googleId: payload.sub,
    email,
    firstName: payload.given_name ?? "",
    lastName: payload.family_name ?? "",
    role: "requestor",
    isApprovedDriver: false,
    isActive: true,
  });
};

const findOrCreateSession = async (user) => {
  const existing = await Session.findOne({
    where: {
      userId: user.id,
      token: { [Op.ne]: "" },
      expirationDate: { [Op.gt]: new Date() },
    },
  });

  if (existing) {
    return existing;
  }

  const token = jwt.sign({ id: user.id }, authConfig.secret, {
    expiresIn: authConfig.sessionSeconds,
  });

  return Session.create({
    token,
    email: user.email,
    userId: user.id,
    expirationDate: new Date(Date.now() + authConfig.sessionSeconds * 1000),
  });
};

exports.login = async (req, res) => {
  const payload = await verifyGoogleCredential(req.body?.credential);

  if (!payload) {
    return res.status(401).send({ message: "Google sign-in failed." });
  }

  const domain = payload.email.trim().toLowerCase().split("@")[1];
  if (!authConfig.allowedEmailDomains.includes(domain)) {
    return res.status(403).send({ message: "Sign in with your OC Google account." });
  }

  try {
    const user = await findOrCreateUser(payload);

    if (!user.isActive) {
      return res.status(403).send({ message: "Your account has been deactivated." });
    }

    const session = await findOrCreateSession(user);

    return res.send({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isApprovedDriver: user.isApprovedDriver,
      token: session.token,
    });
  } catch (err) {
    logger.error(`login failed: ${err.message}`);
    return res.status(500).send({ message: "Could not sign in." });
  }
};

exports.logout = async (req, res) => {
  try {
    await Session.update({ token: "" }, { where: { token: getBearerToken(req) } });
    return res.send({ message: "Signed out." });
  } catch (err) {
    logger.error(`logout failed: ${err.message}`);
    return res.status(500).send({ message: "Could not sign out." });
  }
};

export default exports;

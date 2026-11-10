import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import db from "../app/models/index.js";
import authConfig from "../app/config/auth.config.js";

export const syncTestDatabase = async () => {
  await db.sequelize.sync({ force: true });
};

let userCount = 0;

export const createUser = async (overrides = {}) => {
  userCount += 1;
  return db.user.create({
    email: `user${userCount}@oc.edu`,
    firstName: "Test",
    lastName: `User${userCount}`,
    role: "requestor",
    ...overrides,
  });
};

export const createSession = async (user, { expired = false } = {}) => {
  const token = jwt.sign({ id: user.id, n: Math.random() }, authConfig.secret);
  await db.session.create({
    token,
    email: user.email,
    userId: user.id,
    expirationDate: new Date(Date.now() + (expired ? -1 : 1) * 60 * 60 * 1000),
  });
  return token;
};

let areaCount = 0;

export const createArea = async (overrides = {}) => {
  areaCount += 1;
  return db.area.create({
    name: `Area ${areaCount}`,
    description: null,
    isActive: true,
    ...overrides,
  });
};

export const signInAs = async (role = "requestor", overrides = {}) => {
  const user = await createUser({ role, ...overrides });
  const token = await createSession(user);
  return { user, token, auth: { Authorization: `Bearer ${token}` } };
};

/** Make Google verification succeed with this ID-token payload (no network). */
export const mockGoogleAccount = ({ sub, email, givenName = "Given", familyName = "Family" }) =>
  jest.spyOn(OAuth2Client.prototype, "verifyIdToken").mockResolvedValue({
    getPayload: () => ({ sub, email, given_name: givenName, family_name: familyName }),
  });

export const mockGoogleFailure = () =>
  jest
    .spyOn(OAuth2Client.prototype, "verifyIdToken")
    .mockRejectedValue(new Error("Invalid token signature"));

import db from "../models/index.js";

const User = db.user;
const Session = db.session;

export async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";

  if (!token) {
    return res.status(401).send({ message: "Unauthorized!" });
  }

  try {
    const session = await Session.findOne({
      where: { token },
      include: [{ model: User, as: "user" }],
    });

    const expired = !session || new Date(session.expirationDate).getTime() < Date.now();
    if (expired || !session.user || session.user.isActive === false) {
      return res.status(401).send({ message: "Unauthorized!" });
    }

    req.user = {
      id: session.user.id,
      role: session.user.role,
      email: session.user.email,
    };
    return next();
  } catch (err) {
    return res.status(401).send({ message: "Unauthorized!" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).send({ message: "You do not have permission for this action." });
    }
    return next();
  };
}

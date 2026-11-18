import db from "../models/index.js";
import logger from "../config/logger.js";

const User = db.user;

const exports = {};

const validateName = (value, label) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return { error: `${label} is required.` };
  }
  if (trimmed.length > 100) {
    return { error: `${label} must be 100 characters or fewer.` };
  }
  return { value: trimmed };
};

exports.findMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    return res.send(user);
  } catch (err) {
    logger.error(`profile.findMe failed: ${err.message}`);
    return res.status(500).send({ message: "Could not load profile." });
  }
};

exports.updateMe = async (req, res) => {
  const { firstName, lastName, phone } = req.body ?? {};

  const first = validateName(firstName, "First name");
  if (first.error) {
    return res.status(400).send({ message: first.error });
  }

  const last = validateName(lastName, "Last name");
  if (last.error) {
    return res.status(400).send({ message: last.error });
  }

  const trimmedPhone = typeof phone === "string" ? phone.trim() : "";
  if (trimmedPhone.length > 20) {
    return res.status(400).send({ message: "Phone must be 20 characters or fewer." });
  }

  try {
    const user = await User.findByPk(req.user.id);
    await user.update({
      firstName: first.value,
      lastName: last.value,
      phone: trimmedPhone || null,
    });
    return res.send(user);
  } catch (err) {
    logger.error(`profile.updateMe failed: ${err.message}`);
    return res.status(500).send({ message: "Could not update profile." });
  }
};

export default exports;

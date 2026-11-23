import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import User from "../models/user.model.js";
import { HttpError } from "../utils/httpError.js";

const protect = async (req, res, next) => {
  // The browser keeps the session token in an HTTP-only cookie.
  const token = req.cookies.token;
  if (!token) {
    throw new HttpError(401, "Not authorized. Please log in.");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new HttpError(401, "Invalid or expired session.");
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw new HttpError(401, "Account not found.");
  }

  req.user = user;
  next();
};

// For routes open to everyone: attach the account when the session is valid, otherwise carry on.
export const optionalAuth = async (req, res, next) => {
  const token = req.cookies.token;
  if (token) {
    try {
      const { id } = jwt.verify(token, env.JWT_SECRET);
      req.user = (await User.findById(id)) ?? undefined;
    } catch {
      req.user = undefined;
    }
  }
  next();
};

export const requireAdmin = (req, res, next) => {
  if (!env.adminEmails.includes(req.user.email)) {
    throw new HttpError(403, "Admins only.");
  }
  next();
};

export default protect;

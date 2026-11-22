import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Vercel serves the frontend and /api on one domain, so the cookie is first-party everywhere.
export const getAuthCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: "lax",
});

const generateToken = (res, userId) => {
  const token = jwt.sign({ id: userId }, env.JWT_SECRET, { expiresIn: "7d" });

  res.cookie("token", token, {
    ...getAuthCookieOptions(),
    maxAge: ONE_WEEK_MS,
  });
};

export default generateToken;

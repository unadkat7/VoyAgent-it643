import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Frontend (Vercel) and backend (Render) are different sites, so production needs SameSite=None.
export const getAuthCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? "none" : "lax",
});

const generateToken = (res, userId) => {
  const token = jwt.sign({ id: userId }, env.JWT_SECRET, { expiresIn: "7d" });

  res.cookie("token", token, {
    ...getAuthCookieOptions(),
    maxAge: ONE_WEEK_MS,
  });
};

export default generateToken;

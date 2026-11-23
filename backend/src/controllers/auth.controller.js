import { env } from "../config/env.js";
import generateToken,{ getAuthCookieOptions } from "../utils/generateToken.js";
import { signupService, loginService } from "../services/auth.service.js";
import { recordEvent, referrerHost } from "../services/telemetry.service.js";

const publicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  isAdmin: env.adminEmails.includes(user.email),
});

export const signup = async (req, res) => {
  const signupSource =
    referrerHost(req.body.signupSource ?? req.get("referer"), req.get("host")) ?? "direct";
  const user = await signupService({ ...req.body, signupSource });
  generateToken(res, user._id);
  await recordEvent(req, "signup", { userId: user._id, referrer: signupSource });
  res.status(201).json({ success: true, message: "Account created", user: publicUser(user) });
};

export const login = async (req, res) => {
  const user = await loginService(req.body);
  generateToken(res, user._id);
  await recordEvent(req, "login", { userId: user._id });
  res.status(200).json({ success: true, message: "Login successful", user: publicUser(user) });
};

export const logout = async (req, res) => {
  res.cookie("token", "", { ...getAuthCookieOptions(), expires: new Date(0) });
  res.status(200).json({ success: true, message: "Logged out successfully" });
};

export const getMe = async (req, res) => {
  res.status(200).json({ success: true, user: publicUser(req.user) });
};

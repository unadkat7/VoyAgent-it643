import generateToken, { getAuthCookieOptions } from "../utils/generateToken.js";
import { signupService, loginService } from "../services/auth.service.js";

const publicUser = (user) => ({ _id: user._id, name: user.name, email: user.email });

export const signup = async (req, res) => {
  const user = await signupService(req.body);
  generateToken(res, user._id);
  res.status(201).json({ success: true, message: "Account created", user: publicUser(user) });
};

export const login = async (req, res) => {
  const user = await loginService(req.body);
  generateToken(res, user._id);
  res.status(200).json({ success: true, message: "Login successful", user: publicUser(user) });
};

export const logout = async (req, res) => {
  res.cookie("token", "", { ...getAuthCookieOptions(), expires: new Date(0) });
  res.status(200).json({ success: true, message: "Logged out successfully" });
};

export const getMe = async (req, res) => {
  res.status(200).json({ success: true, user: publicUser(req.user) });
};

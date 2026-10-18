import User from "../models/user.model.js";

export const signupService = async ({ name, email, password }) => {
  // Email addresses identify accounts, so duplicates are not allowed.
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new Error("User already exists");
  }

  // The model hook hashes the password before this is stored.
  const user = await User.create({
    name,
    email,
    password,
  });

  return user;
};

export const loginService = async ({ email, password }) => {
  // Password hashes are hidden by default and are requested only for login.
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    throw new Error("Invalid email or password");
  }

  return user;
};


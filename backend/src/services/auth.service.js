import User from "../models/user.model.js";
import { HttpError } from "../utils/httpError.js";

const DUPLICATE_KEY = 11000;

export const signupService = async ({ name, email, password }) => {
  // Email addresses identify accounts, so duplicates are not allowed.
  if (await User.exists({ email })) {
    throw new HttpError(409, "An account with this email already exists");
  }

  try {
    // The model hook hashes the password before this is stored.
    return await User.create({ name, email, password });
  } catch (error) {
    // Two sign-ups can race past the check above; the unique index settles it.
    if (error.code === DUPLICATE_KEY) {
      throw new HttpError(409, "An account with this email already exists");
    }
    throw error;
  }
};

export const loginService = async ({ email, password }) => {
  // Password hashes are hidden by default and are requested only for login.
  const user = await User.findOne({ email }).select("+password");

  // Same message for both cases so the response does not reveal which emails exist.
  if (!user || !(await user.comparePassword(password))) {
    throw new HttpError(401, "Invalid email or password");
  }

  return user;
};

import User from "../models/user.model.js";

// Admins cannot sign up, so this is the only way to create one or reset its password.
export async function seedAdmin({ email, password }) {
  const user = (await User.findOne({ email })) ?? new User({ name: "Admin", email });
  user.password = password;
  await user.save();
  return user;
}

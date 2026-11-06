// Cross-site HTML forms cannot send application/json, so this blocks form-based CSRF.
export const requireJson = (req, res, next) => {
  if (["POST", "PUT", "PATCH"].includes(req.method) && !req.is("application/json")) {
    return res.status(415).json({
      success: false,
      message: "Content-Type must be application/json",
    });
  }
  return next();
};

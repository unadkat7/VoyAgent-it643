import { z } from "zod";

// Parse, don't validate: handlers only ever see the cleaned, typed body.
export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {});

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid request",
      errors: z.flattenError(result.error).fieldErrors,
    });
  }

  req.body = result.data;
  return next();
};

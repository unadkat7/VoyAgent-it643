import "dotenv/config";
import { app } from "./app.js";

const port = process.env.BACKEND_PORT || 5000;

app.listen(port, () => {
  console.log(`VoyAgent backend running on port ${port}`);
});


import cors from "cors";

// VC-NET-003: Over-permissive CORS with credentials
export const corsMiddleware = cors({
  origin: "*",
  credentials: true,
});

import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

// ---------------------------------------------------------------------------
// Allowed CORS origins
// In production set CORS_ORIGIN to a comma-separated list of permitted domains.
// In development every *.replit.dev subdomain is allowed so preview works.
// ---------------------------------------------------------------------------
const rawOrigins = process.env.CORS_ORIGIN;
const allowedOrigins: (string | RegExp)[] = rawOrigins
  ? rawOrigins.split(",").map((o) => o.trim())
  : [/^https:\/\/[^.]+\.replit\.dev$/];

const app: Express = express();

// Security headers (X-Frame-Options, X-Content-Type-Options, HSTS, CSP, …)
app.use(helmet());

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow server-to-server / curl requests (no Origin header)
      if (!origin) return cb(null, true);
      const allowed = allowedOrigins.some((o) =>
        typeof o === "string" ? o === origin : o.test(origin),
      );
      if (allowed) return cb(null, true);
      logger.warn({ origin }, "CORS: rejected request from unlisted origin");
      cb(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;

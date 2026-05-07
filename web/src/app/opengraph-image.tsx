import { APP_NAME } from "@/config/brand";
import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = `${APP_NAME} — quick picks & your watch log`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          background: "linear-gradient(145deg, #09090b 0%, #18181b 40%, #1e1b4b 100%)",
          padding: 72,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              background: "linear-gradient(160deg, #6366f1 0%, #4f46e5 50%, #4338ca 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fafafa",
              fontSize: 44,
              fontWeight: 800,
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              letterSpacing: "-0.06em",
            }}
          >
            N
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 58,
                fontWeight: 700,
                color: "#fafafa",
                letterSpacing: "-0.03em",
                fontFamily:
                  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              }}
            >
              {APP_NAME}
            </div>
            <div
              style={{
                fontSize: 30,
                color: "#a1a1aa",
                fontWeight: 500,
                fontFamily:
                  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              }}
            >
              Quick picks & your watch log
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 36,
            fontSize: 24,
            color: "#71717a",
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          Genre-aware suggestions · Watchlist · Diary
        </div>
      </div>
    ),
    { ...size },
  );
}

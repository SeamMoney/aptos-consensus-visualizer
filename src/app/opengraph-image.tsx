import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Aptos Velociraptr - Learn how Aptos processes 160,000+ TPS";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0a0a0b 0%, #111113 50%, #0a0a0b 100%)",
          padding: "60px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background grid pattern */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `
              linear-gradient(rgba(0, 217, 165, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 217, 165, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Decorative circles representing consensus nodes */}
        <div
          style={{
            position: "absolute",
            top: "80px",
            right: "100px",
            width: "300px",
            height: "300px",
            borderRadius: "50%",
            border: "2px solid rgba(0, 217, 165, 0.2)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "130px",
            right: "150px",
            width: "200px",
            height: "200px",
            borderRadius: "50%",
            border: "2px solid rgba(0, 217, 165, 0.3)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "180px",
            right: "200px",
            width: "100px",
            height: "100px",
            borderRadius: "50%",
            background: "rgba(0, 217, 165, 0.15)",
            display: "flex",
          }}
        />

        {/* Validator nodes scattered */}
        {[
          { x: 900, y: 150, size: 16 },
          { x: 1000, y: 200, size: 12 },
          { x: 950, y: 280, size: 14 },
          { x: 1050, y: 320, size: 10 },
          { x: 880, y: 350, size: 12 },
          { x: 1020, y: 400, size: 14 },
        ].map((node, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${node.x}px`,
              top: `${node.y}px`,
              width: `${node.size}px`,
              height: `${node.size}px`,
              borderRadius: "50%",
              background: "#00D9A5",
              boxShadow: "0 0 20px rgba(0, 217, 165, 0.5)",
              display: "flex",
            }}
          />
        ))}

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            zIndex: 1,
          }}
        >
          {/* Live badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: "#00D9A5",
                boxShadow: "0 0 10px #00D9A5",
                display: "flex",
              }}
            />
            <span
              style={{
                fontSize: "18px",
                color: "rgba(255, 255, 255, 0.7)",
                fontFamily: "monospace",
                letterSpacing: "2px",
              }}
            >
              MAINNET LIVE
            </span>
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: "72px",
              fontWeight: "700",
              color: "#ffffff",
              margin: 0,
              lineHeight: 1.1,
              display: "flex",
            }}
          >
            Aptos{" "}
            <span style={{ color: "#00D9A5", marginLeft: "20px" }}>
              Velociraptr
            </span>
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: "28px",
              color: "rgba(255, 255, 255, 0.6)",
              margin: "24px 0 0 0",
              maxWidth: "600px",
              lineHeight: 1.4,
              display: "flex",
            }}
          >
            Learn how Aptos processes 160,000+ transactions per second
          </p>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              gap: "40px",
              marginTop: "48px",
            }}
          >
            {[
              { label: "TPS", value: "160K+", color: "#00D9A5" },
              { label: "Latency", value: "<400ms", color: "#3B82F6" },
              { label: "Validators", value: "140+", color: "#F59E0B" },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "16px 24px",
                  background: "rgba(255, 255, 255, 0.05)",
                  borderRadius: "12px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <span
                  style={{
                    fontSize: "36px",
                    fontWeight: "700",
                    color: stat.color,
                    fontFamily: "monospace",
                    display: "flex",
                  }}
                >
                  {stat.value}
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    color: "rgba(255, 255, 255, 0.5)",
                    textTransform: "uppercase",
                    letterSpacing: "2px",
                    display: "flex",
                  }}
                >
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom decorative pipeline */}
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            left: "60px",
            right: "60px",
            height: "4px",
            background: "linear-gradient(90deg, #A855F7 0%, #3B82F6 25%, #00D9A5 50%, #F59E0B 75%, #EF4444 100%)",
            borderRadius: "2px",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size }
  );
}

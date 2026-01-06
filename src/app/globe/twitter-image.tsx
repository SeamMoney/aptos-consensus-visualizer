import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Aptos Global Validator Network - Real-time consensus visualization";
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
          background: "radial-gradient(ellipse at 50% 50%, #0a1628 0%, #050a12 40%, #020408 100%)",
          padding: "60px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Stars background */}
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
              borderRadius: "50%",
              background: `rgba(255, 255, 255, ${0.3 + Math.random() * 0.7})`,
              display: "flex",
            }}
          />
        ))}

        {/* Globe representation */}
        <div
          style={{
            position: "absolute",
            right: "80px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle at 30% 30%, #1a3a5c 0%, #0d2137 50%, #061420 100%)",
            border: "2px solid rgba(0, 217, 165, 0.3)",
            boxShadow: "0 0 60px rgba(0, 217, 165, 0.2), inset 0 0 60px rgba(0, 100, 150, 0.3)",
            display: "flex",
          }}
        />

        {/* Globe grid lines */}
        <div
          style={{
            position: "absolute",
            right: "80px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            border: "1px solid rgba(0, 217, 165, 0.15)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: "130px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "300px",
            height: "400px",
            borderRadius: "50%",
            border: "1px solid rgba(0, 217, 165, 0.1)",
            display: "flex",
          }}
        />

        {/* Validator nodes on globe */}
        {[
          { x: 920, y: 180, size: 12 },
          { x: 1000, y: 220, size: 10 },
          { x: 880, y: 280, size: 14 },
          { x: 960, y: 340, size: 10 },
          { x: 1040, y: 300, size: 12 },
          { x: 900, y: 400, size: 10 },
          { x: 1020, y: 380, size: 8 },
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
              background: "#FFD700",
              boxShadow: "0 0 15px rgba(255, 215, 0, 0.6)",
              display: "flex",
            }}
          />
        ))}

        {/* Arc connections */}
        <svg
          style={{
            position: "absolute",
            right: "80px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "400px",
            height: "400px",
          }}
          viewBox="0 0 400 400"
        >
          <path
            d="M 120 80 Q 200 40 280 100"
            fill="none"
            stroke="rgba(0, 217, 165, 0.6)"
            strokeWidth="2"
          />
          <path
            d="M 80 180 Q 150 120 220 180"
            fill="none"
            stroke="rgba(0, 217, 165, 0.5)"
            strokeWidth="2"
          />
          <path
            d="M 160 240 Q 240 200 320 260"
            fill="none"
            stroke="rgba(0, 217, 165, 0.4)"
            strokeWidth="2"
          />
        </svg>

        {/* Glow behind globe */}
        <div
          style={{
            position: "absolute",
            right: "30px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0, 217, 165, 0.15) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            zIndex: 1,
            maxWidth: "600px",
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
                fontSize: "16px",
                color: "rgba(255, 255, 255, 0.7)",
                fontFamily: "monospace",
                letterSpacing: "2px",
              }}
            >
              LIVE VISUALIZATION
            </span>
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: "56px",
              fontWeight: "700",
              color: "#ffffff",
              margin: 0,
              lineHeight: 1.1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Global Validator</span>
            <span style={{ color: "#00D9A5" }}>Network</span>
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: "24px",
              color: "rgba(255, 255, 255, 0.6)",
              margin: "20px 0 0 0",
              lineHeight: 1.4,
              display: "flex",
            }}
          >
            Watch Aptos consensus in real-time across 140+ validators worldwide
          </p>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              gap: "24px",
              marginTop: "40px",
            }}
          >
            {[
              { label: "Validators", value: "140+", color: "#FFD700" },
              { label: "Block Time", value: "~100ms", color: "#00D9A5" },
              { label: "Countries", value: "19+", color: "#3B82F6" },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "12px 20px",
                  background: "rgba(255, 255, 255, 0.05)",
                  borderRadius: "10px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <span
                  style={{
                    fontSize: "28px",
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
                    fontSize: "12px",
                    color: "rgba(255, 255, 255, 0.5)",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    display: "flex",
                  }}
                >
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Aptos branding */}
        <div
          style={{
            position: "absolute",
            bottom: "30px",
            left: "60px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span
            style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "rgba(255, 255, 255, 0.8)",
            }}
          >
            Aptos Velociraptr
          </span>
          <span
            style={{
              fontSize: "16px",
              color: "rgba(255, 255, 255, 0.4)",
            }}
          >
            |
          </span>
          <span
            style={{
              fontSize: "16px",
              color: "rgba(255, 255, 255, 0.5)",
            }}
          >
            aptos-consensus-visualizer.vercel.app
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}

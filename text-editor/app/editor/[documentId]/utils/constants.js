// app/editor/[documentId]/utils/constants.js
export const ANIMAL_USERS = [
  { name: "🦁 Lion", color: "#F59E0B" },
  { name: "🐸 Frog", color: "#10B981" },
  { name: "🦊 Fox", color: "#F97316" },
  { name: "🐺 Wolf", color: "#6B7280" },
  { name: "🦋 Butterfly", color: "#8B5CF6" },
  { name: "🐙 Octopus", color: "#06B6D4" },
  { name: "🦅 Eagle", color: "#78716C" },
  { name: "🐝 Bee", color: "#EAB308" },
  { name: "🦆 Duck", color: "#3B82F6" },
  { name: "🐯 Tiger", color: "#EF4444" },
  { name: "🦌 Deer", color: "#A3A3A3" },
  { name: "🐰 Rabbit", color: "#EC4899" },
  { name: "🐨 Koala", color: "#84CC16" },
  { name: "🦔 Hedgehog", color: "#F472B6" },
  { name: "🐢 Turtle", color: "#059669" },
  { name: "🦜 Parrot", color: "#DC2626" },
  { name: "🐧 Penguin", color: "#1E40AF" },
  { name: "🦒 Giraffe", color: "#D97706" },
  { name: "🐼 Panda", color: "#374151" },
  { name: "🦘 Kangaroo", color: "#7C2D12" },
  { name: "🐻 Bear", color: "#92400E" },
  { name: "🦓 Zebra", color: "#1F2937" },
  { name: "🐷 Pig", color: "#F472B6" },
  { name: "🐵 Monkey", color: "#A3A3A3" },
  { name: "🐮 Cow", color: "#000000" },
  { name: "🐭 Mouse", color: "#9CA3AF" },
  { name: "🐹 Hamster", color: "#FDE047" },
  { name: "🐱 Cat", color: "#6366F1" },
  { name: "🐶 Dog", color: "#8B5A00" },
  { name: "🦕 Dinosaur", color: "#16A34A" },
];

// Dynamic configuration based on collaboration setup
export const getWebRTCConfig = (token = null) => ({
  signaling: token 
    ? [`wss://signaling-server-production-af26.up.railway.app/signal?token=${token}`]
    : ["wss://signaling-server-production-af26.up.railway.app/signal"],
  maxConn: 20,
  filterBcConns: true,
  peerOpts: {
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    }
  }
});

// Fallback for existing usage
export const WEBRTC_CONFIG = getWebRTCConfig();

export const COLLABORATION_CONFIG = {
  SIGNALING_SERVER: process.env.NODE_ENV === 'production' 
    ? 'wss://signaling-server-production-af26.up.railway.app'
    : 'ws://localhost:3003',
  
  WEB_CLIENT_URL: process.env.NODE_ENV === 'production'
    ? 'https://collate-p2p-landing.vercel.app'  // Future web client
    : 'http://localhost:3000',
    
  JWT_SECRET: 'dev-secret-key-12345', // Same as your signaling server
  
  TOKEN_EXPIRY: {
    PERMANENT: 30 * 24 * 60 * 60 * 1000, // 30 days
    INVITATION: 7 * 24 * 60 * 60 * 1000   // 7 days
  },
  
  ROOM_PREFIX: 'room_'
};

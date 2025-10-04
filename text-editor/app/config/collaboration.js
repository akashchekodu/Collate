export const COLLABORATION_CONFIG = {
  SIGNALING_SERVER:'wss://signaling-server-production-af26.up.railway.app/signal',
  
  WEB_CLIENT_URL: 'https://text-editor-nine-beta.vercel.app',
    
  JWT_SECRET: '41db8ba3fa459485fc41b2a98a2d705ea32ffe41600200506949fb70f5046f02db54eeff', // Same as your signaling server
  
  TOKEN_EXPIRY: {
    PERMANENT: 30 * 24 * 60 * 60 * 1000, // 30 days
    INVITATION: 7 * 24 * 60 * 60 * 1000   // 7 days
  },
  
  ROOM_PREFIX: 'room_'
};

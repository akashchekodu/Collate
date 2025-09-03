import express from 'express';
import cors from 'cors';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Generate JWT token for authenticated user
function generateJWT(user) {
  return jwt.sign(
    {
      id: user.sub,
      email: user.email,
      name: user.name,
      picture: user.picture
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Verify JWT token
function verifyJWT(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Exchange Google OAuth code for user info and JWT
app.post('/auth/google', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    // Exchange code for tokens
    const { tokens } = await googleClient.getToken(code);
    googleClient.setCredentials(tokens);

    // Get user info
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const jwtToken = generateJWT(payload);

    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture
      }
    });

  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Verify JWT endpoint
app.post('/auth/verify', (req, res) => {
  try {
    const { token } = req.body;
    const decoded = verifyJWT(token);
    
    if (decoded) {
      res.json({ valid: true, user: decoded });
    } else {
      res.status(401).json({ valid: false });
    }
  } catch (error) {
    res.status(401).json({ valid: false });
  }
});

app.listen(PORT, () => {
  console.log(`🔐 Auth service running on http://localhost:${PORT}`);
});

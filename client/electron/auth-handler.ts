import { shell } from 'electron';
import { randomBytes } from 'crypto';
import Store from 'electron-store';

interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}
interface UserInfo {
id: string
email: string
name: string
picture?: string
}

interface TokenResponse {
access_token: string
refresh_token?: string
expires_in: number
}


export class AuthHandler {
  private store: Store;
  private pendingState: string | null = null;

  constructor() {
    this.store = new Store();
  }

  async initiateLogin(): Promise<void> {
    const state = randomBytes(32).toString('hex');
    this.pendingState = state;

    const authUrl = this.buildAuthUrl(state);
    
    // Open in default browser instead of Electron window for better security
    await shell.openExternal(authUrl);
  }

  private buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || 'your-client-id',
      redirect_uri: 'p2p-notebook://auth/callback',
      response_type: 'code',
      scope: 'email profile openid',
      access_type: 'offline',
      state: state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleAuthCallback(url: string): Promise<void> {
    try {
      const urlObj = new URL(url);
      const code = urlObj.searchParams.get('code');
      const state = urlObj.searchParams.get('state');

      if (!code || !state || state !== this.pendingState) {
        throw new Error('Invalid callback parameters');
      }

      const tokens = await this.exchangeCodeForTokens(code);
      const user = await this.getUserInfo(tokens.accessToken);

      this.store.set('authTokens', tokens);
      this.store.set('user', user);

      // Notify renderer process
      this.notifyAuthStateChange(user);

      this.pendingState = null;
    } catch (error) {
      console.error('Auth callback error:', error);
      this.notifyAuthStateChange(null);
    }
  }

  private async exchangeCodeForTokens(code: string): Promise<AuthTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: 'p2p-notebook://auth/callback',
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      throw new Error('Token exchange failed');
    }


    const data = await response.json() as TokenResponse
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
    };
  }
  
  private async asJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>
    }


  private async getUserInfo(accessToken: string): Promise<User> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error('Failed to get user info')
  const u = await this.asJson<UserInfo>(response)
  return { id: u.id, email: u.email, name: u.name, picture: u.picture }
}

  async getToken(): Promise<string | null> {
    const tokens = this.store.get('authTokens') as AuthTokens | undefined;
    
    if (!tokens) {
      return null;
    }

    // Check if token is expired
    if (Date.now() >= tokens.expiresAt) {
      if (tokens.refreshToken) {
        try {
          const newTokens = await this.refreshTokens(tokens.refreshToken);
          this.store.set('authTokens', newTokens);
          return newTokens.accessToken;
        } catch (error) {
          console.error('Token refresh failed:', error);
          this.logout();
          return null;
        }
      } else {
        this.logout();
        return null;
      }
    }

    return tokens.accessToken;
  }

  private async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }
    

    const data = await response.json() as TokenResponse;
    
    return {
      accessToken: data.access_token,
      refreshToken: refreshToken, // Keep existing refresh token
      expiresAt: Date.now() + (data.expires_in * 1000),
    };
  }

  logout(): void {
    this.store.delete('authTokens');
    this.store.delete('user');
    this.notifyAuthStateChange(null);
  }

  private notifyAuthStateChange(user: User | null): void {
    // This would need to be implemented to notify the renderer process
    // You could use webContents.send() if you have access to the main window
  }
}
export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export class AuthManager {
  private static instance: AuthManager;
  private user: User | null = null;
  private token: string | null = null;
  private callbacks: Array<(user: User | null) => void> = [];

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  private constructor() {
    this.loadFromStorage();
    this.handleOAuthCallback();
  }

  private loadFromStorage() {
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('user_data');
    
    if (token && user) {
      this.token = token;
      this.user = JSON.parse(user);
      this.verifyToken();
    }
  }

  private async verifyToken() {
    if (!this.token) return;

    try {
      const response = await fetch('http://localhost:3001/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: this.token }),
      });

      const data = await response.json();
      
      if (!data.valid) {
        this.logout();
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      this.logout();
    }
  }

  private handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return;
    }

    if (code && state) {
      const storedState = localStorage.getItem('oauth_state');
      if (state === storedState) {
        this.exchangeCodeForToken(code);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        console.error('State mismatch');
      }
    }
  }

  private async exchangeCodeForToken(code: string) {
    try {
      const response = await fetch('http://localhost:3001/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();
      
      if (data.success) {
        this.token = data.token;
        this.user = data.user;
        
        localStorage.setItem('auth_token', this.token);
        localStorage.setItem('user_data', JSON.stringify(this.user));
        localStorage.removeItem('oauth_state');
        
        this.notifyCallbacks();
      }
    } catch (error) {
      console.error('Token exchange failed:', error);
    }
  }

  initiateGoogleLogin() {
    const state = crypto.randomUUID();
    localStorage.setItem('oauth_state', state);

    const params = new URLSearchParams({
      client_id: '818968151766-iphpmkd75csshep77tvu1ad24nu0mv75.apps.googleusercontent.com', // Replace with your actual client ID
      redirect_uri: 'http://localhost:5173/auth/callback',
      response_type: 'code',
      scope: 'email profile openid',
      access_type: 'offline',
      state: state,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    window.location.href = authUrl;
  }

  logout() {
    this.user = null;
    this.token = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('oauth_state');
    this.notifyCallbacks();
  }

  getUser(): User | null {
    return this.user;
  }

  getToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return this.user !== null && this.token !== null;
  }

  onAuthChange(callback: (user: User | null) => void) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  private notifyCallbacks() {
    this.callbacks.forEach(callback => callback(this.user));
  }
}
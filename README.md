```
# 1. Make script executable
chmod +x setup-docker.sh

# 2. Initial setup (creates structure, copies files, creates .env)
./setup-docker.sh setup

# 3. Edit your Google OAuth credentials
nano .env

# 4. Start everything
./setup-docker.sh dev
```
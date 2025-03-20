🐌 SnailShare - Because Sharing at a Snail's Pace is Still Sharing!
Repository for SnailShare: The file-sharing platform that's so user-friendly, even gastropods can use it!
Description
SnailShare: Where your files move slow but your productivity grows! This TypeScript-powered application delivers your data at a shell-shocking pace. We may not be the fastest, but we carry everything you need on our backs!
🐌 Slow and steady wins the race - Our Express-based server architecture ensures your files arrive exactly when they mean to, not a moment sooner!
🐚 Shell-ter your important files - With our secure middleware, your data is protected like a snail in its shell!
🍃 Leave a trail - Comprehensive logging keeps track of every slime-lined path your files take through our system!
Why SnailShare?
Because in a world of hares rushing to share their files, sometimes you need a gastropod's perspective. After all, what's the hurry? Good things come to those who wait... and wait... and wait...
Remember: Life's a garden, dig it—just watch out for the snails using our app!

## Project Structure

```
src/
├── app.ts               # Main application entry point
├── config/              # Configuration files
├── controllers/         # Request handlers
├── middleware/          # Express middleware
├── models/              # Data models
├── public/              # Static assets
├── routes/              # API routes
├── services/            # Business logic
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
└── views/               # View templates
```

## Getting Started

*Instructions for setup and installation coming soon... just give us time to crawl there!*

## Deployment

### Local Development
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

### Production Deployment with PM2

1. Create a `deploy-config.json` file with your server details:
```json
{
  "host": "your-server-ip",
  "username": "your-username",
  "password": "your-password",
  "port": 22,
  "remotePath": "/path/to/deployment/directory",
  "pm2AppName": "snailshare"
}
```

2. For first-time deployment:
```bash
npm run deploy:first-time
```

3. For subsequent deployments:
```bash
npm run deploy
```

This will:
- Build the project
- Upload all files to your server
- Install dependencies on the server
- Start/restart the PM2 service

Note: Make sure PM2 is installed on your server.

---

*Remember: Life's a garden, dig it—just watch out for the snails using our app!*

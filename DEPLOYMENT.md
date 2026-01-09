# Deployment Guide

## 1. Deploying the Backend
The backend (`/server`) is a Node.js app.
1.  **Hosting**: Use Render, Railway, or Heroku.
2.  **Config**: The server listens on `process.env.PORT`.
3.  **Command**: `node index.js`.

## 2. Deploying the Frontend
The frontend (`/`) is a Vite React app.
1.  **Hosting**: Use Vercel or Netlify.
2.  **Env Var**: Set `VITE_BACKEND_URL` to your backend URL (e.g., `https://my-backend.onrender.com`).
3.  **Command**: `npm run build`.

## 3. Local Development
- **Backend**: `cd server && node index.js`
- **Frontend**: `npm run dev` (Access via `localhost` or LAN IP).

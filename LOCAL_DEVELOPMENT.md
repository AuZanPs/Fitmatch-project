# 🚀 Local Development Setup Guide

## Quick Start

1. **Copy environment file:**
   ```bash
   cp .env .env.local
   ```

2. **Add your API keys to .env.local:**
   ```bash
   # For future AI features (optional)
   HUGGING_FACE_API_KEY=your_hugging_face_api_key
   
   # Get from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_actual_supabase_anon_key
   ```

3. **Set up Supabase database:**
   ```bash
   # See SUPABASE_SETUP.md for complete database schema
   # Run the SQL scripts in your Supabase SQL Editor
   ```

4. **Install dependencies:**
   ```bash
   npm install
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

6. **Open browser:**
   ```
   http://localhost:8080
   ```

## 🔧 Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Lint code
npm run lint
```

## 🌐 Environment Variables

### Client-Side (VITE_ prefix)
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

### Server-Side (API routes)
- `HUGGING_FACE_API_KEY` - Your Hugging Face API key (optional)
- `NODE_ENV` - Environment (development/production)

## 📝 API Keys Setup

### 1. Hugging Face API (Optional - for AI features)
1. Go to [Hugging Face](https://huggingface.co/settings/tokens)
2. Create a new API token
3. Copy the token to `HUGGING_FACE_API_KEY` in `.env.local`

### 2. Supabase
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Settings → API
4. Copy the Project URL and anon/public key
5. Add them to `.env.local`

## 🐛 Troubleshooting

### API Issues
- Check if `HUGGING_FACE_API_KEY` is set correctly (if using AI features)
- AI features are currently in development
- Check browser console for detailed error messages

### Supabase Connection Issues
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Ensure your Supabase project is active
- Check if RLS policies are configured correctly

### Build Issues
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear Vite cache: `rm -rf .vite`
- Check TypeScript errors: `npm run type-check`

## 📁 File Structure

```
├── client/           # React frontend
├── server/           # Express backend (for full-stack setup)
├── api/              # Vercel serverless functions
├── .env              # Environment template
├── .env.local        # Your actual keys (Git ignored)
└── package.json      # Dependencies and scripts
```

## 🚀 Deployment

When ready to deploy:
1. Set environment variables in Vercel dashboard
2. Push to GitHub
3. Deploy with: `vercel --prod`

Happy coding! 🎉

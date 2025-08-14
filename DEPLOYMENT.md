# 🚀 Vercel Deployment Guide

## 📋 **Pre-Deployment Checklist**

### **1. Prepare Environment Variables**

You'll need to add these in your Vercel dashboard:

#### **Supabase Variables** (Get from your Supabase dashboard):
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### **Gemini AI Variable** (Get from Google AI Studio):
```bash
GEMINI_API_KEY=AIzaSyC...
```

#### **Production Environment**:
```bash
NODE_ENV=production
```

### **2. Deploy to Vercel**

#### **Option A: Via Vercel CLI** (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Follow the prompts:
# ? Set up and deploy "test-project"? [Y/n] y
# ? Which scope? [Your Account]
# ? Link to existing project? [y/N] n
# ? What's your project's name? fitmate-app
# ? In which directory is your code located? ./
```

#### **Option B: Via GitHub Integration**
1. Push code to GitHub repository
2. Go to [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your GitHub repository
5. Vercel will auto-detect settings from `vercel.json`

### **3. Configure Environment Variables in Vercel**

After deployment:

1. Go to your project dashboard on Vercel
2. Click **Settings** → **Environment Variables**
3. Add each variable:

| Name | Value | Environment |
|------|-------|-------------|
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` | Production, Preview, Development |
| `GEMINI_API_KEY` | `AIzaSyC...` | Production, Preview, Development |
| `NODE_ENV` | `production` | Production |

4. Click **Save** for each
5. **Redeploy** your application (Settings → Deployments → Redeploy)

### **4. Verify Deployment**

After deployment, check:

#### **✅ Security Check**
- Visit `https://your-app.vercel.app`
- Open DevTools → Network → Check response headers:
  ```
  ✅ strict-transport-security: max-age=31536000
  ✅ x-content-type-options: nosniff
  ✅ x-frame-options: DENY
  ✅ x-xss-protection: 1; mode=block
  ```

#### **✅ API Check**
- Test: `https://your-app.vercel.app/api/health`
- Should return: `{"status": "healthy", ...}`

#### **✅ Authentication Check**
- Try signing up/logging in
- Check AI stylist functionality

### **5. Domain & SSL**

#### **Default Domain:**
- **URL**: `https://your-app-name.vercel.app`
- **SSL**: ✅ Automatic (Let's Encrypt)
- **HTTPS**: ✅ Enforced by default
- **Redirects**: ✅ HTTP → HTTPS automatic

#### **Custom Domain** (Optional, for later):
```bash
# Add custom domain via CLI
vercel domains add yourdomain.com

# Or via dashboard:
# Settings → Domains → Add Domain
```

### **6. Environment-Specific URLs**

Vercel provides multiple environments:

- **Production**: `https://your-app.vercel.app`
- **Preview**: `https://your-app-git-branch.vercel.app`
- **Development**: `http://localhost:3000`

### **7. Monitoring & Logs**

#### **View Logs:**
```bash
# CLI
vercel logs

# Or dashboard → Functions → View Function Logs
```

#### **Performance Monitoring:**
- Built-in Analytics in Vercel dashboard
- Speed insights automatically enabled

### **8. Troubleshooting**

#### **Build Fails:**
```bash
# Check build locally first
npm run build

# Common issues:
# - Missing environment variables
# - TypeScript errors
# - Missing dependencies
```

#### **API Routes Don't Work:**
- Verify `vercel.json` rewrites are correct ✅
- Check environment variables are set ✅
- Look at Function logs in dashboard

#### **CORS Errors:**
- Verify your domain matches regex pattern ✅
- Check Network tab for actual origin ✅

### **9. Production Checklist**

Before going live:

- [ ] All environment variables added
- [ ] Build succeeds locally (`npm run build`)
- [ ] TypeScript check passes (`npm run typecheck`)
- [ ] API endpoints work (`/api/health`)
- [ ] Authentication works
- [ ] AI features work
- [ ] Security headers present
- [ ] HTTPS enforced
- [ ] Performance acceptable

---

## 🎯 **Quick Deploy Commands**

```bash
# One-time setup
npm i -g vercel
vercel login

# Deploy
npm run build  # Test locally first
vercel         # Deploy to production

# Check status
vercel ls      # List deployments
vercel logs    # View logs
```

**Your FitMatch app will be live at**: `https://your-app-name.vercel.app` 🚀

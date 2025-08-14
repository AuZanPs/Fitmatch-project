# Security Guidelines

## Critical: Before Deployment

### 1. Environment Variables
```bash
# Never commit real credentials to Git
# Always use placeholder values in repository

# Client (.env)
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Server (server/.env)
GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. Production Deployment Checklist

#### Environment Setup
- [ ] Replace all placeholder API keys with real values
- [ ] Set `NODE_ENV=production`
- [ ] Update CORS origins to your actual domain
- [ ] Enable HTTPS (TLS/SSL)
- [ ] Set up proper DNS with security headers

#### API Security
- [ ] Rate limiting is enabled (Already implemented)
- [ ] Input validation active (Already implemented)
- [ ] Security headers configured (Already implemented)
- [ ] File upload limits in place (10MB limit set)

#### Database Security
- [ ] Supabase RLS (Row Level Security) enabled
- [ ] Database backups configured
- [ ] Access logs enabled

### 3. Security Features Implemented

#### Server Security
```typescript
// Security Headers
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()

// Rate Limiting
- Outfit Generation: 10 requests/minute
- Styling Advice: 15 requests/minute  
- Item Analysis: 20 requests/minute
- Wardrobe Analysis: 10 requests/minute

// Input Validation
- Zod schema validation on all API endpoints
- File size limits (10MB)
- URL validation for image uploads
- SQL injection prevention (via Supabase)
```

#### Authentication
- Supabase Auth with email/password
- JWT tokens with automatic refresh
- Secure session management
- Protected routes on client-side

#### Data Protection
- Client-side state sanitization
- Server-side input validation
- No sensitive data in logs
- Environment variable isolation

### 4. Security Monitoring

#### Recommended Tools
- Uptime Monitoring: UptimeRobot, Pingdom
- Security Scanning: OWASP ZAP, Snyk
- Log Management: LogRocket, Sentry
- SSL Monitoring: SSL Labs, Let's Encrypt

#### Regular Security Tasks
- [ ] Update dependencies monthly (`npm audit`)
- [ ] Review server logs weekly
- [ ] Test backup restoration quarterly
- [ ] Security penetration testing annually

### 5. Incident Response

#### If API Keys are Compromised
1. Immediately rotate all API keys
2. Update environment variables on hosting platform
3. Check logs for unauthorized access
4. Monitor for unusual API usage

#### If Database is Compromised
1. Enable Supabase incident mode
2. Review RLS policies
3. Check for data exfiltration
4. Update user passwords

### 6. Hosting Security

#### Recommended Platforms
- Frontend: Vercel, Netlify (automatic HTTPS)
- Backend: Railway, Render, DigitalOcean (with SSL)
- Database: Supabase (built-in security)

#### DNS Security
```
# Add these DNS records for security
CAA 0 issue "letsencrypt.org"
TXT "v=spf1 -all"
```

### 7. Development Security

#### Git Security
```bash
# Check for accidentally committed secrets
git log --all --full-history -- .env
git log --all --full-history -- server/.env

# Remove from history if found
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  --prune-empty --tag-name-filter cat -- --all
```

#### Code Review Checklist
- [ ] No hardcoded secrets
- [ ] Input validation on new endpoints
- [ ] Rate limiting on new routes
- [ ] Error messages don't leak sensitive info
- [ ] Dependencies are up to date

## Security Status

- SECURE: Ready for production  
- VALIDATED: Input validation implemented  
- PROTECTED: Rate limiting active  
- HEADERS: Security headers configured  
- CLEAN: No secrets in repository  

Last Security Audit: August 14, 2025  
Next Review Due: September 14, 2025

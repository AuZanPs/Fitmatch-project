# Project Rules and Guidelines for Trae AI IDE

## Core Development Principles

### Code Focus and Changes
1. Only modify code directly related to the assigned task
2. Preserve unrelated code sections
3. Implement comprehensive test coverage for key functionality
4. Maintain existing architectural patterns unless explicitly directed otherwise
5. Consider impact on interconnected code components

### Code Quality Standards
- Write clear, maintainable, and well-documented code
- Ensure consistency with existing codebase style
- Prioritize testability in code design
- Optimize for performance without sacrificing readability
- Implement robust security practices
- Design for maintainability and future extensions
- Create modular and reusable components
- Build scalable and fault-tolerant solutions
- Favor simple, straightforward implementations
- Don't use any emojis in the project

### Best Practices
1. Avoid code duplication - check existing codebase for similar functionality
2. Design for multiple environments (dev/test/prod)
3. Make only well-understood and necessary changes
4. Exhaust existing implementation options before introducing new patterns
5. Maintain clean, organized code structure
6. Limit file size to 200-300 lines maximum
7. Keep test mocks separate from production code
8. Never modify .env files without explicit approval

## Technology Stack

### Frontend Architecture
- React with TypeScript
- Vite (build tooling)
- TailwindCSS (styling)
- Lucide React (iconography)
- Sonner (notifications)
- React Router (navigation)

### Backend Services
- Vercel Serverless Functions
- Supabase Platform
  - Database (PostgreSQL)
  - Authentication
  - Storage
  - Row Level Security
- Development Tools
  - Zod (validation, local server)
  - Express (local/backup server)

### Infrastructure
- Environment Management
  - .env configuration
  - Protected variable handling
- Security
  - API rate limiting
  - Security headers
- Asset Optimization
  - WebP image processing

- Gemini AI
  - Integration with Vercel Serverless Functions
  - Prompt engineering for wardrobe analysis
  - Response parsing and validation

- Debugging
  - Local server logging
  - Browser developer tools
  - Vercel Serverless Functions logs
  - Gemini AI request/response tracing
  - Dont use vite for checking for API, use vercel instead.


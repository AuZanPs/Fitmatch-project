# Contributing to FitMatch

Thank you for your interest in contributing to FitMatch! This document provides guidelines for contributing to the project.

## 🤝 How to Contribute

### 1. Fork and Clone
```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/yourusername/fitMatch.git
cd fitMatch
```

### 2. Set up Development Environment
```bash
# Install dependencies
npm install

# Set up environment variables (see README.md)
# Copy example files and add your real API keys
cp .env.example .env
cp server/.env.example server/.env
# Edit both files with your real credentials

# Start development server
npm run dev
```

### 3. Create a Branch
```bash
# Create a new branch for your feature
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### 4. Make Changes
- Follow the existing code style and patterns
- Add proper TypeScript types
- Include error handling
- Write clear, concise commit messages

### 5. Test Your Changes
```bash
# Run TypeScript check
npm run typecheck

# Build to ensure everything works
npm run build

# Test in browser
npm run dev
```

### 6. Submit Pull Request
1. Push your branch to your fork
2. Create a Pull Request on GitHub
3. Provide a clear description of your changes
4. Link any related issues

## 📝 Development Guidelines

### Code Style
- Use TypeScript for all new code
- Follow existing naming conventions
- Use descriptive variable and function names
- Add JSDoc comments for complex functions

### React Best Practices
- Use functional components with hooks
- Implement proper memoization with `useMemo` and `useCallback`
- Handle loading and error states appropriately
- Follow the existing component structure

### Security Considerations
- Never commit real API keys or secrets
- Validate all user inputs
- Use proper error handling that doesn't expose sensitive information
- Follow the existing security patterns

### Performance
- Optimize images and assets
- Use lazy loading where appropriate
- Implement proper memoization
- Avoid unnecessary re-renders

## 🐛 Bug Reports

When reporting bugs, please include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, browser, Node.js version)
- Console errors or screenshots

## 💡 Feature Requests

For feature requests:
- Explain the problem you're trying to solve
- Describe your proposed solution
- Consider backwards compatibility
- Think about the impact on performance and security

## 🔄 Pull Request Process

1. **Small, focused changes**: Keep PRs focused on a single feature or fix
2. **Clear description**: Explain what changes you made and why
3. **Link issues**: Reference any related GitHub issues
4. **Tests**: Ensure your changes don't break existing functionality
5. **Documentation**: Update README.md if needed

### PR Checklist
- [ ] Code follows project style guidelines
- [ ] TypeScript check passes (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] Changes are well-documented
- [ ] No real API keys or secrets committed
- [ ] Performance impact considered
- [ ] Security implications reviewed

## 🏗️ Project Structure

```
├── client/              # React frontend
│   ├── components/      # Reusable UI components
│   ├── pages/          # Main application pages
│   ├── hooks/          # Custom React hooks
│   └── lib/            # Utilities and configurations
├── server/             # Express backend
│   ├── routes/         # API route handlers
│   ├── services/       # Business logic (AI, etc.)
│   └── middleware/     # Validation and security
├── shared/             # Shared TypeScript types
└── public/             # Static assets
```

## 🧪 Testing

While we don't have extensive automated tests yet, please:
- Test your changes thoroughly in the browser
- Test on different screen sizes
- Verify authentication flows work
- Check AI features function properly
- Ensure error cases are handled gracefully

## 📚 Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Supabase Docs](https://supabase.com/docs)
- [Google Gemini API](https://ai.google.dev/docs)
- [TailwindCSS Docs](https://tailwindcss.com/docs)

## ❓ Questions?

If you have questions about contributing:
- Check existing issues and discussions
- Open a new issue with the `question` label
- Be specific about what you're trying to accomplish

## 🙏 Recognition

Contributors will be recognized in the project. All contributions, no matter how small, are appreciated!

Thank you for helping make FitMatch better! 🎉

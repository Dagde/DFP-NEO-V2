#!/bin/bash

echo "🚀 DFP-NEO Platform - GitHub Setup"
echo "=================================="
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
    echo "📦 Initializing Git repository..."
    git init
    git branch -M main
else
    echo "✅ Git repository already initialized"
fi

# Add all files
echo "📝 Adding files to Git..."
git add .

# Commit
echo "💾 Creating commit..."
git commit -m "Initial commit: DFP-NEO Platform with landing page, auth, and admin panel"

echo ""
echo "✅ Code is ready to push!"
echo ""
echo "📋 Next steps:"
echo "1. Go to GitHub.com"
echo "2. Click the '+' icon in top right"
echo "3. Click 'New repository'"
echo "4. Name it: dfp-neo-platform"
echo "5. Make it PRIVATE (recommended)"
echo "6. Do NOT initialize with README"
echo "7. Click 'Create repository'"
echo ""
echo "8. Copy the commands GitHub shows you, OR run:"
echo "   git remote add origin https://github.com/YOUR_USERNAME/dfp-neo-platform.git"
echo "   git push -u origin main"
echo ""
echo "Press Enter when you've created the GitHub repository..."
read

echo ""
echo "🔗 Now enter your GitHub repository URL:"
echo "Example: https://github.com/YOUR_USERNAME/dfp-neo-platform.git"
read -p "Repository URL: " repo_url

if [ ! -z "$repo_url" ]; then
    echo "🔗 Adding remote repository..."
    git remote add origin "$repo_url" 2>/dev/null || git remote set-url origin "$repo_url"
    
    echo "⬆️  Pushing to GitHub..."
    git push -u origin main
    
    echo ""
    echo "✅ Code successfully pushed to GitHub!"
    echo ""
    echo "🎯 Next: Go to Vercel and import this repository"
else
    echo "❌ No repository URL provided"
fi
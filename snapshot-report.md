# Repository Snapshot: DFP-NEO-V2
## Branch: feature/comprehensive-build-algorithm

### Overview
Successfully cloned the DFP-NEO-V2 repository from the `feature/comprehensive-build-algorithm` branch.

### Git Information
- **Repository**: Dagde/DFP-NEO-V2
- **Branch**: feature/comprehensive-build-algorithm
- **Status**: Working tree clean, up to date with origin
- **Latest Commits**:
  - d86a1e6f feat: Alerts system - browser app implementation
  - 80f7096c feat: Add Alerts tab to iOS app with polling, ACCEPT/REJECT functionality
  - dbeda9c7 fix: permanently delete unavailability entries from database
  - df00166a Fix change bar: persist baseline to DB and restore on reload
  - b9510195 Fix change bar for published Daily DFP events

### Project Structure
Main components identified:
- **Web Application**: Daily Flying Program (React + TypeScript + Vite)
- **Platform**: dfp-neo-platform (Backend services)
- **iOS App**: DFP-NEO-iOS (Swift/SwiftUI)
- **Website**: DFP-NEO-Website

### Codebase Statistics
- **Total TypeScript/TSX files**: 1,024 files
- **Tech Stack**: 
  - React 19.2.0
  - TypeScript 5.8.2
  - Vite 7.3.1
  - Prisma ORM
  - PostgreSQL
  - Express.js

### Key Features
From recent commits:
- Alerts system implementation
- iOS app with polling and acceptance/rejection functionality
- Database management for unavailability entries
- Change bar persistence and restoration
- Daily DFP event management

### Available Branches
Multiple branches including co-pilot features, deployment fixes, and various feature branches indicative of active development.

### Project Configuration
- Name: daily-flying-program
- Type: Module
- Build process: Prisma generate + Vite build to platform directory
- Includes server.js for backend operations

### Notes
- Repository contains nested project structure
- Includes iOS components, web platform, and website
- Active development with recent commits focused on alerts and iOS improvements
- Clean working tree ready for development work
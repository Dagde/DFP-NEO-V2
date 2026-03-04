# DFP-NEO Platform

A sophisticated, enterprise-grade flight scheduling and management platform with multi-version support, robust authentication, and automatic backup systems.

## 🚀 Features

### Authentication & Security
- ✅ Secure credential-based authentication
- ✅ Role-based access control (Super Admin, Admin, User)
- ✅ Session management with NextAuth.js
- ✅ Password hashing with bcrypt
- ✅ Admin-only user registration

### Data Management
- ✅ Primary + Backup database architecture
- ✅ Automatic failover on primary database failure
- ✅ Hourly automatic sync to backup
- ✅ Point-in-time backup snapshots
- ✅ Data persistence across sessions

### User Interface
- ✅ Stunning noir-themed design
- ✅ Custom metal-plate styled components
- ✅ Responsive layout
- ✅ Smooth animations and transitions
- ✅ Professional branding with custom graphics

### Platform Versions
- ✅ **DFP-NEO Flight School** (Active)
- 🔜 DFP-NEO Advanced Training (Coming Soon)
- 🔜 DFP-NEO Commercial Operations (Coming Soon)

### Admin Panel
- ✅ User management (Create, Read, Update, Deactivate)
- ✅ Role assignment
- ✅ Activity monitoring
- ✅ User status management

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL database (or Vercel Postgres)
- Vercel account (for deployment)
- Your custom domain

## 🛠️ Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/dfp-neo-platform.git
   cd dfp-neo-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your database credentials and secrets.

4. **Initialize database**
   ```bash
   npx prisma db push
   ```

5. **Create super admin user**
   ```bash
   npx prisma studio
   ```
   Create a user with role "SUPER_ADMIN"

6. **Run development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

## 🚢 Deployment

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed deployment instructions.

### Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/dfp-neo-platform)

## 📧 Email Addresses

The platform is configured for the following email addresses:
- `admin@your-domain.com` - Administrative contact
- `director@your-domain.com` - Director contact
- `support@your-domain.com` - User support
- `marketing@your-domain.com` - Marketing inquiries
- `super-admin@your-domain.com` - Super admin contact

## 🏗️ Architecture

```
dfp-neo-platform/
├── app/                    # Next.js app directory
│   ├── login/             # Login page
│   ├── select/            # Version selection
│   ├── admin/             # Admin panel
│   ├── flight-school/     # DFP-NEO Flight School
│   └── api/               # API routes
├── lib/                   # Utilities
│   ├── auth/              # Authentication
│   └── db/                # Database & backup
├── components/            # React components
├── prisma/               # Database schema
└── public/               # Static assets
```

## 🔐 Security Features

- Password hashing with bcrypt (10 rounds)
- JWT-based session management
- Role-based access control
- Automatic session expiration (30 days)
- Database connection encryption
- Environment variable protection

## 💾 Backup System

### Automatic Backups
- **Hourly Sync**: Primary → Backup database
- **On-Write**: Automatic failover if primary fails
- **Daily Snapshots**: Point-in-time recovery

### Manual Backup
```bash
npm run backup:create
```

### Restore from Backup
```bash
npm run backup:restore
```

## 👥 User Roles

### Super Admin
- Full system access
- Create/manage admins
- System configuration
- Backup management

### Admin
- Create/manage users
- View all data
- User activity monitoring

### User
- Access assigned versions
- Manage own data
- View own schedules

## 🎨 Customization

### Branding
Replace images in `public/images/`:
- `logo.png` - Main logo
- `username.png` - Username field graphic
- `password.png` - Password field graphic
- `metal-plate.png` - Background texture

### Colors
Edit `tailwind.config.js`:
```javascript
colors: {
  'neo-black': '#000000',
  'neo-metal': '#3a3a3a',
  'neo-silver': '#c0c0c0',
  'neo-chrome': '#e8e8e8',
}
```

## 📊 Monitoring

### Database Health
```bash
npm run db:health
```

### Backup Status
```bash
npm run backup:status
```

### User Activity
Access via Admin Panel → Activity Logs

## 🐛 Troubleshooting

### Common Issues

**Login fails**
- Check database connection
- Verify user is active
- Check password hash

**Database connection error**
- Verify DATABASE_URL in .env
- Check database is running
- Verify network access

**Backup not working**
- Check BACKUP_DATABASE_URL
- Verify backup database exists
- Check logs for errors

## 📝 License

Proprietary - All rights reserved

## 🤝 Support

For support, email support@dfp-neo.com or open an issue on GitHub.

## 🙏 Credits

Built with:
- [Next.js](https://nextjs.org/)
- [NextAuth.js](https://next-auth.js.org/)
- [Prisma](https://www.prisma.io/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Vercel](https://vercel.com/)

---

**DFP-NEO Platform** - Powered by NinjaTech AI# Railway Deployment Trigger

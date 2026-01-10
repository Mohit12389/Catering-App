# Anchal Caterers v2 - Event Management System

A complete event management system for catering businesses with Hindi language support, recipe management, and automatic ingredient population.

## Features

- 🎉 **Event Management** - Create and manage catering events
- 🍽️ **Menu Items** - Organize menu items by categories
- 🥘 **Ingredients** - Track all ingredients with units
- 📝 **Recipe Builder** - Link ingredients to menu items
- 🔄 **Auto-populate Ingredients** - Ingredients auto-fill based on menu selection
- 🖨️ **Print Ready** - Compact, print-optimized layouts
- 🇮🇳 **Hindi Support** - Full Hindi language input support

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL (Neon)
- **ORM**: Prisma
- **Auth**: Clerk
- **Styling**: Tailwind CSS
- **Language**: TypeScript

## Setup Instructions

### 1. Clone and Install

```bash
cd anchal-caterers-v2
npm install
```

### 2. Environment Variables

Create a `.env` file with:

```env
# Clerk Authentication (use your existing keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Neon Database (create new database)
DATABASE_URL="postgresql://username:password@host/database?sslmode=require"
```

### 3. Setup Database

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push
```

### 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Sign in/up pages
│   ├── (dashboard)/     # Protected dashboard pages
│   │   ├── dashboard/
│   │   ├── create-event/
│   │   ├── event-menu/
│   │   ├── event-history/
│   │   └── customize-inventory/
│   ├── api/             # API routes
│   └── globals.css      # All styles
├── components/
│   ├── ui/              # Base UI components
│   ├── shared/          # Reusable components
│   └── layout/          # Layout components
├── hooks/               # Custom hooks
├── lib/                 # Utilities
└── types/               # TypeScript types
```

## Key Workflows

### 1. Setup Inventory (First Time)
1. Go to "Customize Inventory"
2. Add Item Categories (e.g., Punjabi, Chinese)
3. Add Menu Items to categories
4. Add Ingredient Categories (e.g., Vegetables, Dairy)
5. Add Ingredients to categories
6. **Link Ingredients to Menu Items** using Recipe Builder

### 2. Create Event
1. Go to "Create Event"
2. Fill event details
3. Select menu items
4. Submit - ingredients auto-populate based on recipes

### 3. Set Quantities
1. Go to "Event Menu"
2. Select an event
3. Set quantities for each ingredient (grouped by category)
4. Save

### 4. View/Print Event
1. Go to "Event History"
2. Select an event
3. View details with compact ingredient list
4. Export CSV or Print

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Start production
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:studio    # Open Prisma Studio
```

## Hindi Language Support

All input fields support Hindi text. To type in Hindi:

**Mac**: System Preferences → Keyboard → Input Sources → Add Hindi
**Windows**: Settings → Time & Language → Add Hindi

Use keyboard shortcut to switch between English and Hindi while typing.

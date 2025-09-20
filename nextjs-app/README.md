# Next.js + Supabase Web Application

A modern web application built with Next.js 15, TypeScript, Tailwind CSS, and Supabase for authentication and database management.

## Features

- User authentication (Sign Up/Sign In)
- Protected dashboard routes
- Todo list with CRUD operations
- Real-time database with Supabase
- Type-safe development with TypeScript
- Responsive UI with Tailwind CSS

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [Supabase](https://app.supabase.com/)
2. Create a new project
3. Wait for the project to initialize

### 2. Configure Environment Variables

1. Copy `.env.local.example` to `.env.local`
2. Update the values with your Supabase credentials:
   - Get your project URL and anon key from:
     Settings → API → Project URL and Project API keys

```bash
cp .env.local.example .env.local
```

### 3. Setup Database

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Run the SQL script from `supabase/schema.sql` to create the todos table

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Project Structure

```
nextjs-app/
├── app/
│   ├── login/          # Authentication page
│   ├── dashboard/      # Protected dashboard
│   └── page.tsx        # Home page
├── components/
│   ├── TodoList.tsx    # Todo CRUD component
│   └── SignOutButton.tsx
├── lib/
│   └── supabase/       # Supabase client configuration
│       ├── client.ts   # Browser client
│       ├── server.ts   # Server client
│       └── middleware.ts
├── middleware.ts       # Authentication middleware
└── supabase/
    └── schema.sql      # Database schema

```

## Usage

1. **Sign Up**: Create a new account with email and password
2. **Sign In**: Login with your credentials
3. **Dashboard**: Access your personal todo list
4. **Todo Management**: Add, complete, and delete todos

## Technologies Used

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Supabase** - Backend as a Service (Auth + Database)
- **PostgreSQL** - Database (via Supabase)

## Deployment

This application can be deployed on [Vercel](https://vercel.com/):

1. Push your code to GitHub
2. Import the project on Vercel
3. Add environment variables
4. Deploy

## Security Notes

- Row Level Security (RLS) is enabled on all tables
- Users can only access their own data
- Authentication is handled by Supabase Auth
- Never commit `.env.local` to version control

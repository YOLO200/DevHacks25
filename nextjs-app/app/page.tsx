import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-100">
      <div className="text-center space-y-8 p-8">
        <h1 className="text-5xl font-bold text-gray-900">
          Welcome to Next.js + Supabase
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          A modern web application starter with authentication and database integration
        </p>

        <div className="space-y-4">
          <div className="flex gap-4 justify-center">
            <Link
              href="/login"
              className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Get Started
            </Link>
            <a
              href="https://supabase.com/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors font-medium border border-gray-300"
            >
              Learn More
            </a>
          </div>
        </div>

        <div className="pt-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Features</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="font-semibold text-lg mb-2">Authentication</h3>
              <p className="text-gray-600">Secure user authentication with Supabase Auth</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="font-semibold text-lg mb-2">Database</h3>
              <p className="text-gray-600">PostgreSQL database with real-time subscriptions</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="font-semibold text-lg mb-2">Type Safety</h3>
              <p className="text-gray-600">Built with TypeScript for enhanced developer experience</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

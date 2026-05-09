import Image from 'next/image';
import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        {/* Premium Login Card */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Header with subtle green accent */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-12 text-white text-center">
            <div className="mb-6 flex justify-center">
              <div className="p-4 bg-white rounded-lg shadow-sm">
                <Image 
                  src="/logos/IMG-20260506-WA0004(1).jpg" 
                  alt="Joson's SmartKids Academy" 
                  width={100} 
                  height={70}
                  className="h-16 w-auto"
                  priority
                />
              </div>
            </div>
            <h1 className="text-2xl font-bold">Joson's SmartKids Academy</h1>
            <p className="text-blue-100 text-sm mt-2 font-medium">School Management Portal</p>
          </div>

          {/* Form Section */}
          <div className="px-8 py-10">
            {/* Welcome Message */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-slate-900">Welcome Back</h2>
              <p className="text-slate-600 text-sm mt-2">
                Sign in with your account to manage students, fees, and classes
              </p>
            </div>

            {/* Login Form */}
            <div className="mb-6">
              <LoginForm />
            </div>

            {/* Setup Link */}
            <div className="border-t border-slate-200 pt-6 text-center">
              <p className="text-slate-600 text-sm">
                First time? <a href="/setup" className="font-semibold text-blue-600 hover:text-blue-700 transition">
                  Create admin account
                </a>
              </p>
            </div>
          </div>

          {/* Footer Trust Indicators */}
          <div className="bg-slate-50 px-8 py-6 flex justify-around text-center text-xs text-slate-600">
            <div>
              <div className="text-lg font-bold text-slate-900">🔒</div>
              <p className="mt-1">Secure</p>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">⚡</div>
              <p className="mt-1">Fast</p>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">📊</div>
              <p className="mt-1">Reliable</p>
            </div>
          </div>
        </div>

        {/* Footer Text */}
        <p className="text-center text-slate-600 text-xs mt-8">
          © 2026 Joson's SmartKids Academy. All rights reserved.
        </p>
      </div>
    </div>
  );
}

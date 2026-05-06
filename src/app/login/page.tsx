import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md space-y-8 rounded-[2.5rem] border border-slate-200 bg-white p-12 shadow-2xl shadow-slate-200/50">
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tighter text-slate-900">SchoolFlow</h1>
          <p className="mt-3 text-slate-500 font-medium">Administration Portal</p>
        </div>
        <div className="mt-10">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}

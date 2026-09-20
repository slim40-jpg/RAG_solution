'use client';

import { useRouter } from 'next/navigation';
import { LogOut, User } from 'lucide-react';

export default function Header({ user }) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-gray-800">
            📁 Document Archive
          </h1>
          <span className="text-sm text-gray-500 hidden sm:inline">
            {user?.name || 'User'}
          </span>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-gray-500" />
            <span className="text-sm text-gray-600 hidden md:inline">
              {user?.role || 'Role'}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-1 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  FolderOpen, 
  FileText, 
  Search, 
  MessageSquare,
  Users,
  Archive
} from 'lucide-react';

export default function Sidebar({ user }) {
  const pathname = usePathname();

  const menuItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Departments', href: '/departments', icon: FolderOpen },
    { name: 'Documents', href: '/documents', icon: FileText },
    { name: 'Archive Boxes', href: '/archive-boxes', icon: Archive }, // ✅ NEW
    { name: 'Search', href: '/search', icon: Search },
    { name: 'AI Chat', href: '/chat', icon: MessageSquare },
  ];

  // ✅ Only show Users link for admin
  if (user?.role === 'admin') {
    menuItems.push({ name: 'Users', href: '/users', icon: Users });
  }

  return (
    <aside className="w-64 bg-white shadow-sm border-r min-h-screen shrink-0 relative">
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold text-gray-800">📁 Archive</h1>
      </div>
      <nav className="p-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-4 py-2 rounded-md transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
      <div className="absolute bottom-0 p-4 border-t w-64">
        <div className="text-sm text-gray-500">
          <p className="font-medium">{user?.name}</p>
          <p className="text-xs text-gray-400">{user?.role}</p>
        </div>
      </div>
    </aside>
  );
}
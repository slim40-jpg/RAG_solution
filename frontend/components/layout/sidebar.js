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
  Archive,
  Lock,
} from 'lucide-react';

export default function Sidebar({ user }) {
  const pathname = usePathname();

  const menuItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Departments', href: '/departments', icon: FolderOpen },
    { name: 'Documents', href: '/documents', icon: FileText },
    { name: 'Archive Boxes', href: '/archive-boxes', icon: Archive },
    { name: 'Search', href: '/search', icon: Search },
    { name: 'AI Chat', href: '/chat', icon: MessageSquare },
    { name: 'Mes demandes', href: '/access-request', icon: Lock },
  ];

  // Only show Users link for admins
  if (user?.role === 'admin') {
    menuItems.push({
      name: 'Users',
      href: '/users',
      icon: Users,
    });
  }

  // Show pending requests for admins and archivists
  if (user?.role === 'admin' || user?.role === 'archivist') {
    menuItems.push({
      name: 'À valider',
      href: '/access-request/pending',
      icon: Lock,
    });
  }

  return (
    <aside className="relative min-h-screen w-64 shrink-0 border-r bg-white shadow-sm">
      {/* Header */}
      <div className="border-b p-4">
        <h1 className="text-xl font-bold text-gray-800">
          📁 Archive
        </h1>
      </div>

      {/* Navigation */}
      <nav className="space-y-1 p-4">
        {menuItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href ||
                pathname?.startsWith(`${item.href}/`);

          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center space-x-3 rounded-md px-4 py-2 transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User information */}
      <div className="absolute bottom-0 w-full border-t bg-white p-4">
        <div className="text-sm text-gray-500">
          <p className="font-medium">
            {user?.name ?? 'User'}
          </p>
          <p className="text-xs text-gray-400">
            {user?.role ?? 'No role assigned'}
          </p>
        </div>
      </div>
    </aside>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { 
  Files, 
  Users, 
  FolderOpen, 
  FileText,
  CheckCircle,
  Clock
} from 'lucide-react';
import { documentAPI, departmentAPI, userAPI } from '@/lib/api';
import Header from '@/components/layout/header';
import Sidebar from '@/components/layout/sidebar';
import Card from '@/components/ui/card';
import Spinner from '@/components/ui/spinner';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // ✅ Check authentication and get user
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    
    setIsAuthenticated(true);
    const userData = JSON.parse(localStorage.getItem('user') || 'null');
    if (userData) {
      setUser(userData);
      setIsAdmin(userData.role === 'admin');
    }
  }, [router]);

  // ✅ Fetch documents (only if authenticated)
  const { data: documentsData, isLoading: docsLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentAPI.getAll({ limit: 100 }),
    enabled: isAuthenticated, // ✅ Use state instead of localStorage
  });

  // ✅ Fetch departments (only if authenticated)
  const { data: departmentsData, isLoading: deptLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentAPI.getAll(),
    enabled: isAuthenticated,
  });

  // ✅ Fetch users ONLY if admin AND authenticated
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => userAPI.getAll(),
    enabled: isAuthenticated && isAdmin,
  });

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (docsLoading || deptLoading || (isAdmin && usersLoading)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  const documents = documentsData?.data?.documents || [];
  const departments = departmentsData?.data?.departments || [];
  const users = usersData?.data?.users || [];

  // Calculate stats
  const totalDocuments = documents.length;
  const totalDepartments = departments.length;
  const totalUsers = isAdmin ? users.length : 'N/A';
  const completedDocuments = documents.filter(d => d.status === 'completed').length;
  const pendingDocuments = documents.filter(d => d.status === 'pending').length;

  const stats = [
    { title: 'Total Documents', value: totalDocuments, icon: Files, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Departments', value: totalDepartments, icon: FolderOpen, color: 'text-green-600', bg: 'bg-green-50' },
    { 
      title: isAdmin ? 'Total Users' : 'Your Role', 
      value: isAdmin ? totalUsers : user?.role || 'Employee', 
      icon: Users, 
      color: 'text-purple-600', 
      bg: 'bg-purple-50' 
    },
    { title: 'Completed Documents', value: completedDocuments, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <Card key={index} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">{stat.title}</p>
                      <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-full ${stat.bg}`}>
                      <Icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Recent Documents */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Documents</h2>
                <div className="space-y-3">
                  {documents.slice(0, 5).map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                      <div className="flex items-center space-x-3">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-800">{doc.title}</p>
                          <p className="text-xs text-gray-500">{doc.fileName}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        doc.status === 'completed' ? 'bg-green-100 text-green-700' :
                        doc.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        doc.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {doc.status}
                      </span>
                    </div>
                  ))}
                  {documents.length === 0 && (
                    <p className="text-gray-500 text-sm">No documents uploaded yet</p>
                  )}
                </div>
              </Card>

              {/* Quick Actions */}
              <Card>
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  <button 
                    onClick={() => router.push('/documents')}
                    className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                  >
                    <span className="text-blue-700">📤 Upload Document</span>
                    <span className="text-sm text-blue-500">→</span>
                  </button>
                  <button 
                    onClick={() => router.push('/search')}
                    className="w-full flex items-center justify-between p-3 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors"
                  >
                    <span className="text-purple-700">🔍 Search Documents</span>
                    <span className="text-sm text-purple-500">→</span>
                  </button>
                  <button 
                    onClick={() => router.push('/chat')}
                    className="w-full flex items-center justify-between p-3 bg-green-50 hover:bg-green-100 rounded-md transition-colors"
                  >
                    <span className="text-green-700">💬 AI Assistant</span>
                    <span className="text-sm text-green-500">→</span>
                  </button>
                </div>
              </Card>
            </div>

            {/* Show user info */}
            <div className="mt-6 text-sm text-gray-400">
              Logged in as: {user?.name} ({user?.role})
              {!isAdmin && <span className="ml-2 text-yellow-500">⚠️ Some features are restricted</span>}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
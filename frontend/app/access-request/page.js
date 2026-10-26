'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Lock, CheckCircle, XCircle, Clock } from 'lucide-react';
import { accessRequestAPI } from '@/lib/api';
import Header from '@/components/layout/header';
import Sidebar from '@/components/layout/sidebar';
import Card from '@/components/ui/card';
import Spinner from '@/components/ui/spinner';

export default function AccessRequestsPage() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return window.location.href = '/login';
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    if (u) { setUser(u); setIsAuthenticated(true); }
  }, []);

  const { data: myRequests, isLoading } = useQuery({
    queryKey: ['my-requests'],
    queryFn: () => accessRequestAPI.getMyRequests(),
    enabled: isAuthenticated,
  });

  const requests = myRequests?.data?.requests || [];

  if (!isAuthenticated) return <Spinner size="lg" />;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Mes demandes d'accès</h1>

            {isLoading ? <Spinner size="lg" /> : requests.length === 0 ? (
              <Card className="text-center py-12">
                <Lock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Aucune demande</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {requests.map(req => (
                  <Card key={req.id}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{req.document?.title}</p>
                        <p className="text-sm text-gray-500">
                          Département : {req.targetDepartment?.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          Demandé le {new Date(req.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        req.status === 'approved' ? 'bg-green-100 text-green-700' :
                        req.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        req.status === 'revoked' ? 'bg-gray-100 text-gray-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {req.status === 'pending' ? '⏳ En attente' :
                         req.status === 'approved' ? '✅ Approuvé' :
                         req.status === 'rejected' ? '❌ Rejeté' : '🚫 Révoqué'}
                      </span>
                    </div>
                    {req.status === 'approved' && req.expiresAt && (
                      <p className="text-xs text-green-600 mt-2">
                        Expire le {new Date(req.expiresAt).toLocaleDateString()}
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
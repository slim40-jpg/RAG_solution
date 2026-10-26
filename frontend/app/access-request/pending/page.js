'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckCircle, XCircle } from 'lucide-react';
import { accessRequestAPI } from '@/lib/api';
import Header from '@/components/layout/header';
import Sidebar from '@/components/layout/sidebar';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';

export default function PendingAccessRequestsPage() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return window.location.href = '/login';
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    if (u) { setUser(u); setIsAuthenticated(true); }
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['pending-requests'],
    queryFn: () => accessRequestAPI.getPending(),
    enabled: isAuthenticated,
  });

  const approveMutation = useMutation({
    mutationFn: (id) => accessRequestAPI.approve(id, { expiresInDays: 30 }),
    onSuccess: () => {
      queryClient.invalidateQueries(['pending-requests']);
      toast.success('Demande approuvée');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => accessRequestAPI.reject(id, { reviewComment: 'Rejeté' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['pending-requests']);
      toast.success('Demande rejetée');
    },
  });

  const requests = data?.data?.requests || [];

  if (!isAuthenticated) return <Spinner size="lg" />;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Demandes d'accès à valider</h1>

            {isLoading ? <Spinner size="lg" /> : requests.length === 0 ? (
              <Card className="text-center py-12">
                <p className="text-gray-500">Aucune demande en attente</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {requests.map(req => (
                  <Card key={req.id}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">Demande de : {req.requester?.name}</p>
                        <p className="text-sm text-gray-500">Email : {req.requester?.email}</p>
                        <p className="text-sm mt-1">Document : <strong>{req.document?.title}</strong></p>
                        {req.reason && <p className="text-xs text-gray-600 mt-1">Motif : {req.reason}</p>}
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => approveMutation.mutate(req.id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approuver
                        </Button>
                        <Button
                          onClick={() => rejectMutation.mutate(req.id)}
                          variant="danger"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Rejeter
                        </Button>
                      </div>
                    </div>
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
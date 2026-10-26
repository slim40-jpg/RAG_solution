'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Box, MapPin, FileText, Plus } from 'lucide-react';
import { archiveBoxAPI, documentAPI } from '@/lib/api';
import Header from '@/components/layout/header';
import Sidebar from '@/components/layout/sidebar';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';

export default function ArchiveBoxDetailPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const id = params.id;
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState('');
  const [documents, setDocuments] = useState([]);

  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || 'null');
    if (userData) setUser(userData);
  }, []);
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  // Fetch box details
  const { data, isLoading } = useQuery({
    queryKey: ['archiveBox', id],
    queryFn: () => archiveBoxAPI.getById(id),
    enabled: !!id && !!localStorage.getItem('token'),
  });

  // Fetch available documents
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await documentAPI.getAll({ limit: 100 });
        setDocuments(response.data.documents || []);
      } catch (error) {
        console.error('Failed to fetch documents:', error);
      }
    };
    fetchDocuments();
  }, []);

  const assignMutation = useMutation({
    mutationFn: archiveBoxAPI.assignDocument,
    onSuccess: () => {
      queryClient.invalidateQueries(['archiveBox', id]);
      queryClient.invalidateQueries(['archiveBoxes']);
      toast.success('Document assigned to box successfully');
      setShowAssignModal(false);
      setSelectedDocument('');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to assign document');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (documentId) => archiveBoxAPI.removeDocument(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries(['archiveBox', id]);
      queryClient.invalidateQueries(['archiveBoxes']);
      toast.success('Document removed from box');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to remove document');
    },
  });

  const box = data?.data?.archiveBox;
  const documentCount = data?.data?.documentCount || 0;

  const handleAssign = () => {
    if (!selectedDocument) {
      toast.error('Please select a document');
      return;
    }
    assignMutation.mutate({ documentId: selectedDocument, archiveBoxId: id });
  };

  const handleRemove = (documentId) => {
    if (confirm('Remove this document from the archive box?')) {
      removeMutation.mutate(documentId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!box) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Archive box not found</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center space-x-4 mb-6">
              <button
                onClick={() => router.push('/archive-boxes')}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{box.name}</h1>
                <p className="text-sm text-gray-500">Code: {box.code}</p>
              </div>
            </div>

            {/* Box Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="font-medium text-gray-800">
                      {box.shelfNumber && `Étagère ${box.shelfNumber}`}
                      {box.rowNumber && `, Rangée ${box.rowNumber}`}
                      {box.boxNumber && `, Boîte ${box.boxNumber}`}
                      {!box.shelfNumber && !box.rowNumber && !box.boxNumber && 'Non spécifié'}
                    </p>
                  </div>
                  <MapPin className="w-8 h-8 text-blue-500" />
                </div>
              </Card>
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Documents</p>
                    <p className="font-medium text-gray-800">{documentCount} / {box.maxCapacity}</p>
                  </div>
                  <FileText className="w-8 h-8 text-green-500" />
                </div>
              </Card>
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <p className={`font-medium ${box.isFull ? 'text-red-600' : 'text-green-600'}`}>
                      {box.isFull ? 'Plein' : `${Math.round((documentCount / box.maxCapacity) * 100)}% utilisé`}
                    </p>
                  </div>
                  <Box className="w-8 h-8 text-purple-500" />
                </div>
              </Card>
            </div>

            {/* Documents */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Documents in this Box</h2>
              <Button size="sm" onClick={() => setShowAssignModal(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Add Document
              </Button>
            </div>

            <Card>
              {box.documents && box.documents.length > 0 ? (
                <div className="space-y-2">
                  {box.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors">
                      <div>
                        <p className="font-medium text-gray-800">{doc.title}</p>
                        <p className="text-sm text-gray-500">{doc.fileName}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => router.push(`/documents/${doc.id}`)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleRemove(doc.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No documents in this archive box</p>
              )}
            </Card>

            {/* Assign Modal */}
            {showAssignModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-md">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Add Document to Box</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Document
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={selectedDocument}
                        onChange={(e) => setSelectedDocument(e.target.value)}
                      >
                        <option value="">Select a document...</option>
                        {documents
                          .filter(d => !d.archiveBoxId || d.archiveBoxId === id)
                          .map((doc) => (
                            <option key={doc.id} value={doc.id}>
                              {doc.title} ({doc.fileName})
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="flex space-x-3">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setShowAssignModal(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={handleAssign}
                        className="flex-1"
                      >
                        Assign
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
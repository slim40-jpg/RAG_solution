'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FileText, Upload, Search, Trash2, Eye, Download } from 'lucide-react';
import { documentAPI, departmentAPI } from '@/lib/api';
import Header from '@/components/layout/header';
import Sidebar from '@/components/layout/sidebar';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import DocumentUpload from '@/components/documents/page';

export default function DocumentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterDocumentType, setFilterDocumentType] = useState('');
  const [departments, setDepartments] = useState([]);
  const [user, setUser] = useState(null);
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
    }
  }, [router]);

  // Fetch departments
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const fetchDepartments = async () => {
      try {
        const response = await departmentAPI.getAll();
        setDepartments(response.data.departments || []);
      } catch (error) {
        console.error('Failed to fetch departments:', error);
      }
    };
    fetchDepartments();
  }, [isAuthenticated]);

  // Fetch documents
  const { data, isLoading } = useQuery({
    queryKey: ['documents', filterDepartment, filterDocumentType, searchTerm],
    queryFn: () => documentAPI.getAll({
      departmentId: filterDepartment || undefined,
      documentType: filterDocumentType || undefined,
      search: searchTerm || undefined,
      limit: 100,
    }),
    enabled: isAuthenticated,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => documentAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['documents']);
      toast.success('Document deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to delete document');
    },
  });

  const documents = data?.data?.documents || [];

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this document?')) {
      deleteMutation.mutate(id);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // ✅ Show loading while checking auth
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Documents</h1>
              <Button onClick={() => setShowUpload(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              <select
                value={filterDocumentType}
                onChange={(e) => setFilterDocumentType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Document Types</option>
                <option value="facture">Facture</option>
                <option value="bon_commande">Bon de Commande</option>
                <option value="cahier_charges">Cahier des Charges</option>
                <option value="lettre">Lettre</option>
                <option value="contrat">Contrat</option>
                <option value="rapport">Rapport</option>
                <option value="autre">Autre</option>
              </select>
            </div>

            {/* Documents List */}
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : documents.length === 0 ? (
              <Card className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No documents found</p>
                <Button className="mt-4" onClick={() => setShowUpload(true)}>
                  Upload your first document
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {documents.map((doc) => (
                  <Card key={doc.id} className="hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-5 h-5 text-blue-500" />
                          <h3 className="font-medium text-gray-800 truncate">{doc.title}</h3>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{doc.fileName}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatFileSize(doc.fileSize)} • {doc.fileType}
                        </p>
                        {doc.documentType && (
                          <span className="text-xs text-gray-400 mt-1 block">
                            Type: {doc.documentType}
                          </span>
                        )}
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

                    <div className="mt-3 flex items-center justify-between border-t pt-3">
                      <div className="text-xs text-gray-400">
                        {doc.department?.name || 'No department'}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => router.push(`/documents/${doc.id}`)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Upload Modal */}
            {showUpload && (
              <DocumentUpload onClose={() => setShowUpload(false)} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
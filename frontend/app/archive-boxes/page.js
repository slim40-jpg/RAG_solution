'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Package, Plus, Edit, Trash2, Archive, MapPin, Box } from 'lucide-react';
import { archiveBoxAPI, departmentAPI } from '@/lib/api';
import Header from '@/components/layout/header';
import Sidebar from '@/components/layout/sidebar';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Spinner from '@/components/ui/spinner';

export default function ArchiveBoxesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBox, setEditingBox] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false); // ✅ ADDED

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    shelfNumber: '',
    rowNumber: '',
    boxNumber: '',
    description: '',
    departmentId: '',
    maxCapacity: 100,
  });

  // ✅ Single useEffect for auth
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    setIsAuthenticated(true); // ✅ ADDED
    const userData = JSON.parse(localStorage.getItem('user') || 'null');
    if (userData) setUser(userData);
  }, [router]);

  // Fetch departments (only when authenticated)
  useEffect(() => {
    if (!isAuthenticated) return; // ✅ ADDED

    const fetchDepartments = async () => {
      try {
        const response = await departmentAPI.getAll();
        setDepartments(response.data.departments || []);
      } catch (error) {
        console.error('Failed to fetch departments:', error);
      }
    };
    fetchDepartments();
  }, [isAuthenticated]); // ✅ ADDED

  // Fetch archive boxes
  const { data, isLoading } = useQuery({
    queryKey: ['archiveBoxes'],
    queryFn: () => archiveBoxAPI.getAll(),
    enabled: isAuthenticated, // ✅ FIXED: no localStorage here
  });

  const createMutation = useMutation({
    mutationFn: archiveBoxAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['archiveBoxes']);
      toast.success('Archive box created successfully');
      handleCloseModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to create archive box');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => archiveBoxAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['archiveBoxes']);
      toast.success('Archive box updated successfully');
      handleCloseModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to update archive box');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: archiveBoxAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['archiveBoxes']);
      toast.success('Archive box deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to delete archive box');
    },
  });

  const archiveBoxes = data?.data?.archiveBoxes || [];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingBox) {
      updateMutation.mutate({ id: editingBox.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (box) => {
    setEditingBox(box);
    setFormData({
      name: box.name,
      code: box.code,
      shelfNumber: box.shelfNumber || '',
      rowNumber: box.rowNumber || '',
      boxNumber: box.boxNumber || '',
      description: box.description || '',
      departmentId: box.departmentId || '',
      maxCapacity: box.maxCapacity || 100,
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this archive box?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBox(null);
    setFormData({
      name: '',
      code: '',
      shelfNumber: '',
      rowNumber: '',
      boxNumber: '',
      description: '',
      departmentId: '',
      maxCapacity: 100,
    });
  };

  // Show spinner while checking auth
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
              <h1 className="text-2xl font-bold text-gray-800">
                <Archive className="inline-block mr-2" />
                Archive Boxes
              </h1>
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Archive Box
              </Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : archiveBoxes.length === 0 ? (
              <Card className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No archive boxes created yet</p>
                <Button className="mt-4" onClick={() => setIsModalOpen(true)}>
                  Create your first archive box
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {archiveBoxes.map((box) => (
                  <Card key={box.id} className="hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <Box className="w-5 h-5 text-blue-500" />
                          <h3 className="font-medium text-gray-800">{box.name}</h3>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Code: {box.code}</p>
                        <div className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                          <MapPin className="w-4 h-4" />
                          <span>
                            {box.shelfNumber && `Étagère ${box.shelfNumber}`}
                            {box.rowNumber && `, Rangée ${box.rowNumber}`}
                            {box.boxNumber && `, Boîte ${box.boxNumber}`}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {box.description || 'No description'}
                        </p>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                          <span>📄 {box.documentCount || 0} documents</span>
                          <span>📦 Max: {box.maxCapacity}</span>
                          {box.department && (
                            <span>🏢 {box.department.name}</span>
                          )}
                        </div>
                        <div className="mt-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            (box.documentCount || 0) >= box.maxCapacity
                              ? 'bg-red-100 text-red-700'
                              : (box.documentCount || 0) >= box.maxCapacity * 0.8
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {box.isFull ? 'Plein' :
                             `${Math.round(((box.documentCount || 0) / box.maxCapacity) * 100)}% utilisé`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-end space-x-2 border-t pt-3">
                      <button
                        onClick={() => router.push(`/archive-boxes/${box.id}`)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <Package className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(box)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(box.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {isModalOpen && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">
                    {editingBox ? 'Edit Archive Box' : 'Create Archive Box'}
                  </h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                      label="Name *"
                      type="text"
                      placeholder="e.g., Documents Financiers 2025"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                    <Input
                      label="Code *"
                      type="text"
                      placeholder="e.g., FIN-2025-A1"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      required
                    />
                    <Input
                      label="Shelf Number"
                      type="text"
                      placeholder="e.g., A1"
                      value={formData.shelfNumber}
                      onChange={(e) => setFormData({ ...formData, shelfNumber: e.target.value })}
                    />
                    <Input
                      label="Row Number"
                      type="text"
                      placeholder="e.g., 01"
                      value={formData.rowNumber}
                      onChange={(e) => setFormData({ ...formData, rowNumber: e.target.value })}
                    />
                    <Input
                      label="Box Number"
                      type="text"
                      placeholder="e.g., 001"
                      value={formData.boxNumber}
                      onChange={(e) => setFormData({ ...formData, boxNumber: e.target.value })}
                    />
                    <Input
                      label="Description"
                      type="text"
                      placeholder="Brief description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                    <Input
                      label="Max Capacity"
                      type="number"
                      placeholder="100"
                      value={formData.maxCapacity}
                      onChange={(e) => setFormData({ ...formData, maxCapacity: parseInt(e.target.value) || 100 })}
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Department (Optional)
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.departmentId}
                        onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                      >
                        <option value="">None</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex space-x-3 pt-4">
                      <Button type="button" variant="secondary" onClick={handleCloseModal} className="flex-1">
                        Cancel
                      </Button>
                      <Button type="submit" className="flex-1">
                        {editingBox ? 'Update' : 'Create'}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FolderOpen, Plus, Edit, Trash2 } from 'lucide-react';
import { departmentAPI } from '@/lib/api';
import Header from '@/components/layout/header';
import Sidebar from '@/components/layout/sidebar';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Spinner from '@/components/ui/spinner';

export default function DepartmentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    archiveLocation: '',
  });

  const user = JSON.parse(localStorage.getItem('user') || 'null');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  const { data, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentAPI.getAll(),
    enabled: !!localStorage.getItem('token'),
  });

  const createMutation = useMutation({
    mutationFn: departmentAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['departments']);
      toast.success('Department created successfully');
      handleCloseModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to create department');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => departmentAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['departments']);
      toast.success('Department updated successfully');
      handleCloseModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to update department');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: departmentAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['departments']);
      toast.success('Department deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to delete department');
    },
  });

  const departments = data?.data?.departments || [];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingDept) {
      updateMutation.mutate({ id: editingDept.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (dept) => {
    setEditingDept(dept);
    setFormData({
      name: dept.name,
      description: dept.description || '',
      archiveLocation: dept.archiveLocation || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this department?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingDept(null);
    setFormData({ name: '', description: '', archiveLocation: '' });
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Departments</h1>
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Department
              </Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : departments.length === 0 ? (
              <Card className="text-center py-12">
                <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No departments created yet</p>
                <Button className="mt-4" onClick={() => setIsModalOpen(true)}>
                  Create your first department
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {departments.map((dept) => (
                  <Card key={dept.id} className="hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <FolderOpen className="w-5 h-5 text-blue-500" />
                          <h3 className="font-medium text-gray-800">{dept.name}</h3>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {dept.description || 'No description'}
                        </p>
                        {dept.archiveLocation && (
                          <p className="text-xs text-gray-400 mt-1">
                            📍 {dept.archiveLocation}
                          </p>
                        )}
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                          <span>📄 {dept.documentCount || 0} documents</span>
                          <span>👤 {dept.userCount || 0} users</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-end space-x-2 border-t pt-3">
                      <button
                        onClick={() => handleEdit(dept)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(dept.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Modal */}
            {isModalOpen && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-md">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">
                    {editingDept ? 'Edit Department' : 'Create Department'}
                  </h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                      label="Name *"
                      type="text"
                      placeholder="Department name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                    <Input
                      label="Description"
                      type="text"
                      placeholder="Department description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                    <Input
                      label="Archive Location"
                      type="text"
                      placeholder="Aisle 1, Shelf A"
                      value={formData.archiveLocation}
                      onChange={(e) => setFormData({ ...formData, archiveLocation: e.target.value })}
                    />
                    <div className="flex space-x-3 pt-4">
                      <Button type="button" variant="secondary" onClick={handleCloseModal} className="flex-1">
                        Cancel
                      </Button>
                      <Button type="submit" className="flex-1">
                        {editingDept ? 'Update' : 'Create'}
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
'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { X, Upload, File } from 'lucide-react';
import { documentAPI, departmentAPI, archiveBoxAPI } from '@/lib/api';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';

export default function DocumentUpload({ onClose }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [archiveBoxes, setArchiveBoxes] = useState([]);
  const [file, setFile] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    departmentId: '',
    archiveBoxId: '',
    documentType: 'autre',
    author: '',
    documentDate: '',
    reference: '',
    client: '',
    amount: '',
    description: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [depts, boxes] = await Promise.all([
          departmentAPI.getAll(),
          archiveBoxAPI.getAll(),
        ]);
        setDepartments(depts.data.departments || []);
        setArchiveBoxes(boxes.data.archiveBoxes || []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };
    fetchData();
  }, []);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!formData.title) {
        setFormData({ ...formData, title: selectedFile.name.split('.')[0] });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setLoading(true);
    const uploadData = new FormData();
    uploadData.append('file', file);
    uploadData.append('title', formData.title || file.name);
    if (formData.departmentId) {
      uploadData.append('departmentId', formData.departmentId);
    }
    if (formData.archiveBoxId) {
      uploadData.append('archiveBoxId', formData.archiveBoxId);
    }
    uploadData.append('documentType', formData.documentType);
    uploadData.append('author', formData.author || '');
    uploadData.append('documentDate', formData.documentDate || '');
    uploadData.append('reference', formData.reference || '');
    uploadData.append('client', formData.client || '');
    uploadData.append('amount', formData.amount || '');
    uploadData.append('description', formData.description || '');

    try {
      await documentAPI.upload(uploadData);
      queryClient.invalidateQueries(['documents']);
      toast.success('Document uploaded successfully');
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Upload Document</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              File *
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center hover:border-blue-500 transition-colors">
              <input
                type="file"
                onChange={handleFileChange}
                className="hidden"
                id="fileInput"
              />
              <label htmlFor="fileInput" className="cursor-pointer">
                {file ? (
                  <div className="flex items-center justify-center space-x-2">
                    <File className="w-8 h-8 text-blue-500" />
                    <span className="text-sm text-gray-600">{file.name}</span>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Click to select a file</p>
                    <p className="text-xs text-gray-400">PDF, Word, Excel, Images</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Title */}
          <Input
            label="Title"
            type="text"
            placeholder="Document title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />

          {/* Document Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Document Type
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.documentType}
              onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
            >
              <option value="facture">Facture</option>
              <option value="bon_commande">Bon de Commande</option>
              <option value="cahier_charges">Cahier des Charges</option>
              <option value="lettre">Lettre</option>
              <option value="contrat">Contrat</option>
              <option value="rapport">Rapport</option>
              <option value="autre">Autre</option>
            </select>
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Department
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

          {/* Archive Box */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Archive Box
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.archiveBoxId}
              onChange={(e) => setFormData({ ...formData, archiveBoxId: e.target.value })}
            >
              <option value="">None</option>
              {archiveBoxes.map((box) => (
                <option key={box.id} value={box.id}>
                  {box.code} - {box.name}
                </option>
              ))}
            </select>
          </div>

          {/* Author */}
          <Input
            label="Author"
            type="text"
            placeholder="Author name"
            value={formData.author}
            onChange={(e) => setFormData({ ...formData, author: e.target.value })}
          />

          {/* Document Date */}
          <Input
            label="Document Date"
            type="date"
            value={formData.documentDate}
            onChange={(e) => setFormData({ ...formData, documentDate: e.target.value })}
          />

          {/* Reference */}
          <Input
            label="Reference"
            type="text"
            placeholder="Reference number"
            value={formData.reference}
            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
          />

          {/* Client */}
          <Input
            label="Client"
            type="text"
            placeholder="Client name"
            value={formData.client}
            onChange={(e) => setFormData({ ...formData, client: e.target.value })}
          />

          {/* Amount */}
          <Input
            label="Amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          />

          {/* Description */}
          <Input
            label="Description"
            type="text"
            placeholder="Brief description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />

          <div className="flex space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" isLoading={loading} className="flex-1">
              Upload
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, FileText, Filter } from 'lucide-react';
import { searchAPI, departmentAPI } from '@/lib/api';
import Header from '@/components/layout/header';
import Sidebar from '@/components/layout/sidebar';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState([]);

  const user = JSON.parse(localStorage.getItem('user') || 'null');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await departmentAPI.getAll();
        setDepartments(response.data.departments || []);
      } catch (error) {
        console.error('Failed to fetch departments:', error);
      }
    };
    fetchDepartments();
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['search', searchTerm, departmentId],
    queryFn: () => searchAPI.search({
      query: searchTerm,
      departmentId: departmentId || undefined,
      limit: 20,
    }),
    enabled: false,
  });

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      refetch();
    }
  };

  const results = data?.data?.results || [];

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">🔍 Search Documents</h1>

            {/* Search Form */}
            <form onSubmit={handleSearch} className="mb-6">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <input
                    type="text"
                    placeholder="Search for documents..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                <Button type="submit">
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
              </div>
            </form>

            {/* Results */}
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">Found {results.length} results</p>
                {results.map((result, index) => (
                  <Card key={index} className="hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-800">
                          {result.document?.title || 'Untitled'}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {result.document?.fileName}
                        </p>
                        <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-3 rounded-md">
                          {result.snippet}
                        </p>
                        <div className="flex items-center space-x-4 mt-3">
                          <span className="text-xs text-gray-400">
                            Score: {(result.score * 100).toFixed(1)}%
                          </span>
                          {result.document?.department && (
                            <span className="text-xs text-gray-400">
                              Department: {result.document.department.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => router.push(`/documents/${result.document?.id}`)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View →
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : searchTerm && !isLoading ? (
              <Card className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No results found for "{searchTerm}"</p>
                <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
              </Card>
            ) : (
              <Card className="text-center py-12">
                <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Enter a search term to begin</p>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
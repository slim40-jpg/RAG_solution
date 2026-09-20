'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Bot, User, Loader2, AlertTriangle, Lock, Unlock } from 'lucide-react';
import { chatAPI } from '@/lib/api';
import Header from '@/components/layout/header';
import Sidebar from '@/components/layout/sidebar';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import toast from 'react-hot-toast';

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState([]);
  const [restrictedDepartments, setRestrictedDepartments] = useState([]);
  const [accessibleCount, setAccessibleCount] = useState(0);
  const [restrictedCount, setRestrictedCount] = useState(0);
  const [showRestrictedWarning, setShowRestrictedWarning] = useState(false);
  const messagesEndRef = useRef(null);
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // ✅ Check authentication
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Reset restriction state
    setRestrictedDepartments([]);
    setShowRestrictedWarning(false);
    setSources([]);

    // Add user message
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await chatAPI.ask({
        question: input,
        topK: 5,
      });

      const data = response.data;
      
      // ✅ Afficher la réponse de l'assistant
      const aiMessage = { role: 'assistant', content: data.answer };
      setMessages(prev => [...prev, aiMessage]);
      
      // ✅ Gérer les sources
      if (data.sources?.length > 0) {
        setSources(data.sources);
      }

      // ✅ Gérer les restrictions
      if (data.restrictedDepartments && data.restrictedDepartments.length > 0) {
        setRestrictedDepartments(data.restrictedDepartments);
        setShowRestrictedWarning(true);
        setAccessibleCount(data.accessibleCount || 0);
        setRestrictedCount(data.restrictedCount || 0);
      }

    } catch (error) {
      const errorMessage = { 
        role: 'assistant', 
        content: 'Désolé, une erreur est survenue. Veuillez réessayer.' 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Demander l'accès à un département
  const handleRequestAccess = (departmentName) => {
    toast.success(`📩 Demande d'accès envoyée à ${departmentName}`);
    // TODO: Appeler l'API pour envoyer la demande
  };

  // ✅ Formater la date pour les sources
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

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
        
        <main className="flex-1 overflow-hidden p-6">
          <div className="max-w-4xl mx-auto h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-bold text-gray-800">💬 AI Assistant</h1>
              {user?.role === 'employee' && (
                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  🔒 Accès: Votre département + Public
                </span>
              )}
              {user?.role === 'admin' && (
                <span className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  👑 Accès: Tous les documents
                </span>
              )}
              {user?.role === 'archivist' && (
                <span className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                  📚 Accès: Tous les documents
                </span>
              )}
            </div>

            <Card className="flex-1 overflow-y-auto mb-4 p-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Bot className="w-16 h-16 text-gray-300 mb-4" />
                  <p className="text-gray-500">Posez une question sur vos documents !</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Je peux vous aider à trouver des informations, résumer des documents et répondre à vos questions.
                  </p>
                  {user?.role === 'employee' && (
                    <p className="text-xs text-gray-400 mt-2">
                      🔒 Je ne peux accéder qu'aux documents de votre département et aux documents publics.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex items-start space-x-3 ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-5 h-5 text-blue-600" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
                      {message.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-gray-600" />
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {loading && (
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="bg-gray-100 p-3 rounded-lg">
                        <Spinner size="sm" />
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              )}
            </Card>

            {/* ✅ Sources */}
            {sources.length > 0 && (
              <div className="mb-4">
                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-600 hover:text-gray-800 font-medium">
                    📚 Sources ({sources.length})
                  </summary>
                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                    {sources.map((source, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded-md border border-gray-200">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-700">{source.title}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            source.visibility === 'public' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {source.visibility === 'public' ? '📢 Public' : '🔒 Privé'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{source.fileName}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Pertinence: {(source.relevanceScore * 100).toFixed(1)}%
                          {source.departmentId && (
                            <span className="ml-2">• Département: {source.departmentId}</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-600 mt-1 italic">
                          "{source.snippet}"
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}

            {/* ✅ Avertissement de restriction */}
            {showRestrictedWarning && restrictedDepartments.length > 0 && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">Accès restreint</h3>
                    <div className="mt-1 text-sm text-yellow-700">
                      <p>
                        Des documents de <strong>{restrictedDepartments.map(d => d.name).join(', ')}</strong> 
                        ont été trouvés mais sont privés.
                      </p>
                      <p className="mt-1 text-xs">
                        {accessibleCount} document(s) accessible(s) sur {accessibleCount + restrictedCount} trouvé(s).
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {restrictedDepartments.map((dept) => (
                          <button
                            key={dept.id}
                            onClick={() => handleRequestAccess(dept.name)}
                            className="inline-flex items-center px-3 py-1.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-md hover:bg-yellow-200 transition-colors"
                          >
                            📩 Demander l'accès à {dept.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ✅ Input */}
            <form onSubmit={handleSend} className="flex space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Posez votre question..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <Button type="submit" disabled={loading}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
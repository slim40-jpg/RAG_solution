'use client';

import { useState } from 'react';
import { Lock, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { accessRequestAPI } from '@/lib/api';

export default function AccessRequestButton({ documentId, documentTitle, departmentName }) {
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState(false);

  const handleRequest = async () => {
    setLoading(true);
    try {
      await accessRequestAPI.create({
        documentId,
        reason: `Demande d'accès au document "${documentTitle}"`
      });
      setRequested(true);
      toast.success('Demande d\'accès envoyée !');
    } catch (error) {
      if (error.response?.status === 409) {
        setRequested(true);
        toast.error('Une demande est déjà en attente');
      } else {
        toast.error('Erreur lors de la demande');
      }
    } finally {
      setLoading(false);
    }
  };

  if (requested) {
    return (
      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
        <CheckCircle className="inline w-4 h-4 mr-1" />
        Demande envoyée — En attente de validation
      </div>
    );
  }

  return (
    <button
      onClick={handleRequest}
      disabled={loading}
      className="mt-2 inline-flex items-center px-3 py-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-sm rounded-md transition-colors disabled:opacity-50"
    >
      <Lock className="w-4 h-4 mr-1" />
      {loading ? 'Envoi...' : `Demander l'accès à ${departmentName || 'ce département'}`}
    </button>
  );
}
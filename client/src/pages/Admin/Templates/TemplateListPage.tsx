import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { EmptyState } from '../../../components/shared/EmptyState';
import { Plus, Edit, Trash2 } from 'lucide-react';
import type { RequestTemplate } from '@req-tracker/shared';

export function TemplateListPage() {
  const [templates, setTemplates] = useState<RequestTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTemplates(); }, []);

  async function loadTemplates() {
    try {
      const res = await api.get('/templates');
      setTemplates(res.data.data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Deactivate this template?')) return;
    await api.delete(`/templates/${id}`);
    await loadTemplates();
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Request Templates</h1>
        <Link to="/admin/templates/new" className="btn-primary">
          <Plus className="w-4 h-4" /> New Template
        </Link>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          title="No templates"
          description="Create your first template to start accepting requests"
          action={<Link to="/admin/templates/new" className="btn-primary"><Plus className="w-4 h-4" /> New Template</Link>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <div key={t.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t.name}</h3>
                  {t.description && <p className="text-sm text-gray-500 mt-1">{t.description}</p>}
                  <p className="text-xs text-gray-400 mt-2">Prefix: <span className="font-mono">{t.prefix}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                <Link to={`/admin/templates/${t.id}/edit`} className="btn-secondary btn-sm">
                  <Edit className="w-3.5 h-3.5" /> Edit
                </Link>
                <button onClick={() => handleDelete(t.id)} className="btn-secondary btn-sm text-red-600 hover:text-red-700">
                  <Trash2 className="w-3.5 h-3.5" /> Deactivate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../../../api/client';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { Save } from 'lucide-react';

export function SystemSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      const res = await api.get('/settings');
      setSettings(res.data.data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/settings', settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  }

  function updateSetting(key: string, value: string) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">System Settings</h1>

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">General</h2>
        <div>
          <label className="label">Application Name</label>
          <input type="text" value={settings.app_name?.replace(/"/g, '') ?? ''} onChange={e => updateSetting('app_name', `"${e.target.value}"`)} className="input" />
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">SLA & Nudge Settings</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Default SLA (hours)</label>
            <input type="number" value={settings.sla_default_hours ?? '72'} onChange={e => updateSetting('sla_default_hours', e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Nudge Threshold (hours)</label>
            <input type="number" value={settings.nudge_threshold_hours ?? '72'} onChange={e => updateSetting('nudge_threshold_hours', e.target.value)} className="input" />
            <p className="text-xs text-gray-400 mt-1">Hours before nudge button appears</p>
          </div>
          <div>
            <label className="label">Nudge Cooldown (hours)</label>
            <input type="number" value={settings.nudge_cooldown_hours ?? '24'} onChange={e => updateSetting('nudge_cooldown_hours', e.target.value)} className="input" />
            <p className="text-xs text-gray-400 mt-1">Min hours between nudges</p>
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Email Notifications</h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.email_enabled === 'true'}
            onChange={e => updateSetting('email_enabled', String(e.target.checked))}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Enable email notifications</span>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">SMTP Host</label>
            <input type="text" value={settings.smtp_host?.replace(/"/g, '') ?? ''} onChange={e => updateSetting('smtp_host', `"${e.target.value}"`)} className="input" placeholder="smtp.example.com" />
          </div>
          <div>
            <label className="label">SMTP Port</label>
            <input type="number" value={settings.smtp_port ?? '587'} onChange={e => updateSetting('smtp_port', e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">SMTP User</label>
            <input type="text" value={settings.smtp_user?.replace(/"/g, '') ?? ''} onChange={e => updateSetting('smtp_user', `"${e.target.value}"`)} className="input" />
          </div>
          <div>
            <label className="label">SMTP Password</label>
            <input type="password" value={settings.smtp_pass?.replace(/"/g, '') ?? ''} onChange={e => updateSetting('smtp_pass', `"${e.target.value}"`)} className="input" />
          </div>
          <div>
            <label className="label">From Address</label>
            <input type="email" value={settings.smtp_from?.replace(/"/g, '') ?? ''} onChange={e => updateSetting('smtp_from', `"${e.target.value}"`)} className="input" placeholder="noreply@example.com" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} className="btn-primary" disabled={saving}>
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {saved && <span className="text-sm text-green-600 dark:text-green-400">Settings saved successfully</span>}
      </div>
    </div>
  );
}

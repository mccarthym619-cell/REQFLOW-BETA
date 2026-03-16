import { useState } from 'react';
import { useSession } from '../../context/SessionContext';
import { api } from '../../api/client';
import { Globe, MapPin } from 'lucide-react';

const TIMEZONES = Intl.supportedValuesOf('timeZone');

export function UserSettingsPage() {
  const { user, setUser } = useSession();
  const [timezone, setTimezone] = useState(user?.timezone || 'UTC');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');

  const filteredTimezones = search
    ? TIMEZONES.filter(tz => tz.toLowerCase().includes(search.toLowerCase()))
    : TIMEZONES;

  function detectBrowserTimezone() {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) setTimezone(detected);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await api.put('/users/me/timezone', { timezone });
      setUser(res.data.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save timezone:', err);
      alert('Failed to save timezone setting');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Timezone</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          All timestamps in the app will be displayed in your selected timezone.
        </p>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search timezones..."
                className="input mb-2"
              />
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="input"
                size={8}
              >
                {filteredTimezones.map(tz => (
                  <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={detectBrowserTimezone}
              className="btn-secondary btn-sm"
            >
              <MapPin className="w-3.5 h-3.5" /> Detect from browser
            </button>
            <span className="text-sm text-gray-500">
              Current: <span className="font-medium text-gray-900 dark:text-gray-100">{timezone.replace(/_/g, ' ')}</span>
            </span>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || timezone === user?.timezone}
              className="btn-primary btn-sm"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            {saved && (
              <span className="text-sm text-green-600 dark:text-green-400">Timezone saved successfully</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

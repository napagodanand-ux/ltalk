import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera } from 'lucide-react';

import { useAuthStore } from '../../stores/authStore';
import { uploadAvatar, updateProfile } from '../../lib/api/profiles';
import { Avatar, Button, IconButton, Input, Textarea, Spinner, Toast, ToastProvider, ToastViewport } from '../ui';
import { ROUTES } from '../../lib/constants';
import { cn } from '../../lib/helpers';
import { useIsMobile } from '../../lib/hooks';

export function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  if (!user || !profile) {
    return (
      <div className="flex h-full items-center justify-center bg-bg">
        <Spinner />
      </div>
    );
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(user.id, file);
      await updateProfile(user.id, { avatar_url: url });
      await refreshProfile();
    } catch {
      setToastOpen(false);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile(user.id, { display_name: displayName, bio });
      await refreshProfile();
      setToastOpen(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto max-w-[560px] p-6">
        <div
          className={cn(
            'mb-4 flex items-center gap-2',
            isMobile && 'wa-header -mx-6 -mt-6 mb-4 px-4 py-3'
          )}
        >
          <IconButton label="Back" onClick={() => navigate(ROUTES.app)}>
            <ArrowLeft size={18} />
          </IconButton>
          <h1
            className={cn(
              'text-base font-semibold text-content',
              isMobile && 'text-white'
            )}
          >
            Profile
          </h1>
        </div>

        <div className="rounded-xl border border-edge bg-surface p-6 shadow-panel">
          <div className="flex items-center gap-4">
            <Avatar
              src={profile.avatar_url}
              name={profile.display_name || profile.username}
              size={64}
            />
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <Button
                variant="outline"
                className="flex h-8 items-center gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Spinner size={14} /> : <Camera size={14} />}
                Change photo
              </Button>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-content-muted" htmlFor="displayName">
                Display name
              </label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-content-muted" htmlFor="bio">
                Bio
              </label>
              <Textarea
                id="bio"
                rows={3}
                placeholder="Tell people a bit about yourself"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-content-muted">Username</label>
              <Input type="text" value={profile.username} readOnly className="opacity-70" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-content-muted">Email</label>
              <Input
                type="text"
                value={user.email ?? ''}
                readOnly
                className="opacity-70"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              className="flex h-9 items-center gap-2"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Spinner size={16} /> : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      <ToastProvider>
        <ToastViewport />
        <Toast message="Saved" open={toastOpen} onOpenChange={setToastOpen} />
      </ToastProvider>
    </div>
  );
}

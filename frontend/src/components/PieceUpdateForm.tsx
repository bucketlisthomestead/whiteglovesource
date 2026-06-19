import { useRef, useState } from 'react';
import { Camera, Check } from 'lucide-react';
import { Button, FormField, inputClass, selectClass, textareaClass } from './Layout';
import type { Piece, PieceEventForm, PieceStage, ConditionRating } from '../types';
import { STAGE_LABELS, CONDITION_LABELS, STAGE_TO_PHOTO_MILESTONE, PHOTO_MILESTONE_LABELS } from '../lib/labels';
import { addPieceEvent, uploadPhoto } from '../api/client';
import { queuePieceEvent } from '../offline/sync';
import { updateCachedPiece } from '../offline/db';
import { applyDemoPieceUpdate } from '../offline/demoLocal';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';

interface PieceUpdateFormProps {
  piece: Piece;
  onSuccess: (updated: Piece) => void;
  onCancel: () => void;
  isDemo?: boolean;
  layout?: 'inline' | 'modal';
}

export function PieceUpdateForm({ piece, onSuccess, onCancel, isDemo, layout = 'inline' }: PieceUpdateFormProps) {
  const { user } = useAuth();
  const { isOnline, refreshPending } = useOffline();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [form, setForm] = useState<PieceEventForm>({
    stage: piece.currentStage,
    condition: piece.currentCondition,
    location: piece.currentLocation || '',
    notes: '',
  });

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPhotoPreview(base64);
      setForm((f) => ({ ...f, photoBase64: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const photoMilestone = STAGE_TO_PHOTO_MILESTONE[form.stage];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isDemo) {
        const updated = applyDemoPieceUpdate(
          piece,
          { ...form, photoMilestone },
          user?.name,
        );
        onSuccess(updated);
        return;
      }

      let photoUrl = form.photoUrl;

      if (form.photoBase64 && isOnline) {
        const blob = await (await fetch(form.photoBase64)).blob();
        const result = await uploadPhoto(blob);
        photoUrl = result.url;
      }

      const updatedPiece: Piece = {
        ...piece,
        currentStage: form.stage,
        currentCondition: form.condition,
        currentLocation: form.location,
        photoUrl: photoUrl || piece.photoUrl,
      };

      if (isOnline) {
        try {
          const result = await addPieceEvent(piece.id, {
            ...form,
            photoUrl,
            photoMilestone,
          });
          onSuccess({ ...piece, ...result });
          return;
        } catch {
          // fall through to offline queue
        }
      }

      await queuePieceEvent(piece.id, { ...form, photoUrl }, user?.name);
      await updateCachedPiece(updatedPiece);
      await refreshPending();
      onSuccess(updatedPiece);
    } finally {
      setLoading(false);
    }
  };

  const isModal = layout === 'modal';

  const actions = (
    <div className={`flex gap-3 ${isModal ? '' : 'pt-2'}`}>
      <Button type="button" variant="outline" onClick={onCancel} className="flex-1 min-h-[52px]">
        Cancel
      </Button>
      <Button type="submit" loading={loading} className="flex-1 min-h-[52px]">
        <Check size={16} className="mr-1" /> Save
      </Button>
    </div>
  );

  const fields = (
    <>
      <p className="font-serif text-lg">{piece.name}</p>
      {piece.vendor && <p className="text-xs text-charcoal/50">{piece.vendor}</p>}

      <FormField label="Stage" required>
        <select
          className={selectClass}
          value={form.stage}
          onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value as PieceStage }))}
        >
          {Object.entries(STAGE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </FormField>

      <FormField label="Condition" required>
        <select
          className={selectClass}
          value={form.condition}
          onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value as ConditionRating }))}
        >
          {Object.entries(CONDITION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </FormField>

      <FormField label="Location" required>
        <input
          className={inputClass}
          value={form.location}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          required
        />
      </FormField>

      <FormField label="Notes">
        <textarea
          className={textareaClass}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </FormField>

      <FormField label="Condition Photo">
        {photoMilestone && (
          <p className="text-xs text-charcoal/50 mb-2">
            Photo will be saved to{' '}
            <span className="font-medium">{PHOTO_MILESTONE_LABELS[photoMilestone]}</span> milestone
          </p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhoto}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-cream-dark hover:border-gold transition-colors min-h-[80px]"
        >
          <Camera size={20} className="text-gold" />
          <span className="text-sm text-charcoal/60">Tap to capture photo</span>
        </button>
        {photoPreview && (
          <img src={photoPreview} alt="Preview" className="mt-2 w-full max-h-40 object-cover" />
        )}
      </FormField>

      {!isOnline && !isDemo && (
        <p className="text-xs text-amber-700 bg-amber-50 p-3">
          Offline — this update will sync automatically when you're back online.
        </p>
      )}
    </>
  );

  if (isModal) {
    return (
      <form
        onSubmit={handleSubmit}
        className="grid grid-rows-[minmax(0,1fr)_auto] max-h-[88dvh] w-full bg-cream md:rounded overflow-hidden"
      >
        <div className="overflow-y-auto overscroll-contain p-6 space-y-4 min-h-0">
          {fields}
        </div>
        <div className="border-t border-cream-dark bg-cream p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {actions}
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields}
      {actions}
    </form>
  );
}

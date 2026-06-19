import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { getPieceCatalog } from '../api/client';
import { FormField, inputClass, selectClass } from './Layout';
import { CATALOG_CATEGORY_LABELS, formatCurrency } from '../lib/labels';
import { catalogPieceBreakdown } from '../lib/quotePricing';
import type { PieceCatalogItem, QuoteRoom, StorageType } from '../types';

const DEFAULT_ROOM_NAMES = ['Living Room', 'Primary Bedroom', 'Dining Room', 'Kitchen', 'Office'];

interface QuoteRoomsEditorProps {
  rooms: QuoteRoom[];
  onChange: (rooms: QuoteRoom[]) => void;
  storageMonths?: number;
  storageType?: StorageType;
  disabled?: boolean;
}

function emptyRoom(name = 'Living Room'): QuoteRoom {
  return { name, items: [] };
}

export function QuoteRoomsEditor({
  rooms,
  onChange,
  storageMonths = 1,
  storageType = 'standard_climate',
  disabled = false,
}: QuoteRoomsEditorProps) {
  const [catalog, setCatalog] = useState<PieceCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPieceCatalog()
      .then(setCatalog)
      .catch(() => setCatalog([]))
      .finally(() => setLoading(false));
  }, []);

  const catalogByCategory = useMemo(() => {
    const map = new Map<string, PieceCatalogItem[]>();
    for (const item of catalog) {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [catalog]);

  const catalogItem = (id: string) => catalog.find((c) => c.id === id);
  const catalogName = (id: string) => catalogItem(id)?.name ?? 'Unknown item';

  const updateRoomName = (index: number, name: string) => {
    onChange(rooms.map((r, i) => (i === index ? { ...r, name } : r)));
  };

  const addRoom = () => {
    const used = new Set(rooms.map((r) => r.name));
    const suggestion = DEFAULT_ROOM_NAMES.find((n) => !used.has(n)) ?? 'Additional Room';
    onChange([...rooms, emptyRoom(suggestion)]);
  };

  const removeRoom = (index: number) => {
    onChange(rooms.filter((_, i) => i !== index));
  };

  const updateItemQty = (roomIndex: number, catalogItemId: string, quantity: number) => {
    onChange(
      rooms.map((room, i) => {
        if (i !== roomIndex) return room;
        const items = room.items.filter((it) => it.catalogItemId !== catalogItemId);
        if (quantity > 0) items.push({ catalogItemId, quantity });
        return { ...room, items };
      }),
    );
  };

  const addItemToRoom = (roomIndex: number, catalogItemId: string) => {
    if (!catalogItemId) return;
    const room = rooms[roomIndex];
    const existing = room.items.find((i) => i.catalogItemId === catalogItemId);
    if (existing) {
      updateItemQty(roomIndex, catalogItemId, existing.quantity + 1);
    } else {
      updateItemQty(roomIndex, catalogItemId, 1);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-gold" size={24} />
      </div>
    );
  }

  const displayRooms = rooms.length ? rooms : [emptyRoom()];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-charcoal/70">Add rooms and catalogue pieces for this quote.</p>
        {!disabled && (
          <button
            type="button"
            onClick={addRoom}
            className="flex items-center gap-1 text-xs uppercase tracking-wider text-gold min-h-[44px] px-3"
          >
            <Plus size={14} /> Add room
          </button>
        )}
      </div>

      {displayRooms.map((room, roomIndex) => (
        <div key={roomIndex} className="bg-cream/40 border border-cream-dark p-4 space-y-3">
          <div className="flex items-center gap-3">
            <input
              className={`${inputClass} flex-1 font-medium`}
              value={room.name}
              disabled={disabled}
              onChange={(e) => updateRoomName(roomIndex, e.target.value)}
              placeholder="Room name"
            />
            {!disabled && displayRooms.length > 1 && (
              <button
                type="button"
                onClick={() => removeRoom(roomIndex)}
                className="p-2 text-charcoal/40 hover:text-red-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Remove room"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          {room.items.length > 0 && (
            <div className="space-y-2 border-t border-cream-dark pt-3">
              {room.items.map((item) => {
                const cat = catalogItem(item.catalogItemId);
                const breakdown = cat
                  ? catalogPieceBreakdown(cat, storageMonths, storageType)
                  : null;
                return (
                  <div key={item.catalogItemId} className="flex items-start gap-3 py-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{catalogName(item.catalogItemId)}</p>
                      {breakdown && (
                        <p className="text-[10px] text-charcoal/45 mt-0.5">
                          {formatCurrency(breakdown.pickup)} pickup
                          {storageMonths > 0 && (
                            <> · {formatCurrency(breakdown.storage)} storage</>
                          )}
                          {' · '}
                          {formatCurrency(breakdown.install)} install
                        </p>
                      )}
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      disabled={disabled}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItemQty(roomIndex, item.catalogItemId, parseInt(e.target.value, 10) || 0)
                      }
                      className="w-14 px-2 py-2 border border-cream-dark text-center text-sm min-h-[44px] shrink-0"
                    />
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => updateItemQty(roomIndex, item.catalogItemId, 0)}
                        className="p-2 text-charcoal/40 hover:text-red-600 shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!disabled && (
            <FormField label="Add piece from catalogue">
              <select
                className={selectClass}
                value=""
                onChange={(e) => {
                  addItemToRoom(roomIndex, e.target.value);
                  e.target.value = '';
                }}
              >
                <option value="">Select a piece…</option>
                {[...catalogByCategory.entries()].map(([category, items]) => (
                  <optgroup
                    key={category}
                    label={
                      CATALOG_CATEGORY_LABELS[category as keyof typeof CATALOG_CATEGORY_LABELS] ??
                      category
                    }
                  >
                    {items.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </FormField>
          )}
        </div>
      ))}
    </div>
  );
}

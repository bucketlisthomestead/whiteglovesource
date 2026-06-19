import { FormField, inputClass, selectClass } from './Layout';
import type { Client, CreateClientInput, CreateDesignerInput, Designer } from '../types';

type AssignMode = 'existing' | 'new';

function ModeToggle({
  mode,
  onChange,
  existingLabel = 'Existing',
  newLabel = 'Create new',
}: {
  mode: AssignMode;
  onChange: (mode: AssignMode) => void;
  existingLabel?: string;
  newLabel?: string;
}) {
  return (
    <div className="flex gap-1 mb-3">
      {(['existing', 'new'] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={`flex-1 px-3 py-2 text-xs uppercase tracking-wider min-h-[40px] border transition-colors ${
            mode === value
              ? 'border-gold bg-gold/10 text-charcoal font-medium'
              : 'border-cream-dark text-charcoal/50'
          }`}
        >
          {value === 'existing' ? existingLabel : newLabel}
        </button>
      ))}
    </div>
  );
}

export function DesignerAssignFields({
  mode,
  onModeChange,
  designerId,
  onDesignerIdChange,
  designers,
  newDesigner,
  onNewDesignerChange,
}: {
  mode: AssignMode;
  onModeChange: (mode: AssignMode) => void;
  designerId: string;
  onDesignerIdChange: (id: string) => void;
  designers: Designer[];
  newDesigner: CreateDesignerInput;
  onNewDesignerChange: (value: CreateDesignerInput) => void;
}) {
  return (
    <FormField label="Designer" required>
      <ModeToggle mode={mode} onChange={onModeChange} />
      {mode === 'existing' ? (
        <select
          className={selectClass}
          aria-label="Designer"
          value={designerId}
          onChange={(e) => onDesignerIdChange(e.target.value)}
          required
        >
          <option value="">Select designer…</option>
          {designers.map((d) => (
            <option key={d.id} value={d.id}>{d.name} — {d.firm}</option>
          ))}
        </select>
      ) : (
        <div className="space-y-3 border border-cream-dark p-3">
          <input
            className={inputClass}
            placeholder="Full name"
            value={newDesigner.name}
            onChange={(e) => onNewDesignerChange({ ...newDesigner, name: e.target.value })}
            required
          />
          <input
            className={inputClass}
            placeholder="Design firm"
            value={newDesigner.firm}
            onChange={(e) => onNewDesignerChange({ ...newDesigner, firm: e.target.value })}
            required
          />
          <input
            type="email"
            className={inputClass}
            placeholder="Email (login)"
            value={newDesigner.email}
            onChange={(e) => onNewDesignerChange({ ...newDesigner, email: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              className={inputClass}
              placeholder="Phone"
              value={newDesigner.phone || ''}
              onChange={(e) => onNewDesignerChange({ ...newDesigner, phone: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="City"
              value={newDesigner.city || ''}
              onChange={(e) => onNewDesignerChange({ ...newDesigner, city: e.target.value })}
            />
          </div>
          <input
            type="password"
            className={inputClass}
            placeholder="Temporary password (min 6 chars)"
            value={newDesigner.password}
            onChange={(e) => onNewDesignerChange({ ...newDesigner, password: e.target.value })}
            required
            minLength={6}
          />
          <p className="text-[10px] text-charcoal/40">Creates designer profile and login account.</p>
        </div>
      )}
    </FormField>
  );
}

type ClientAssignMode = AssignMode | 'auto';

export function ClientAssignFields({
  mode,
  onModeChange,
  clientId,
  onClientIdChange,
  clients,
  newClient,
  onNewClientChange,
  autoLabel,
}: {
  mode: ClientAssignMode;
  onModeChange: (mode: ClientAssignMode) => void;
  clientId: string;
  onClientIdChange: (id: string) => void;
  clients: Client[];
  newClient: CreateClientInput;
  onNewClientChange: (value: CreateClientInput) => void;
  autoLabel?: string;
}) {
  return (
    <FormField label="Client" required={mode !== 'auto'}>
      <div className="flex gap-1 mb-3">
        {(['existing', 'new', ...(autoLabel ? (['auto'] as const) : [])] as ClientAssignMode[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onModeChange(value)}
            className={`flex-1 px-2 py-2 text-[10px] sm:text-xs uppercase tracking-wider min-h-[40px] border transition-colors ${
              mode === value
                ? 'border-gold bg-gold/10 text-charcoal font-medium'
                : 'border-cream-dark text-charcoal/50'
            }`}
          >
            {value === 'existing' ? 'Existing' : value === 'new' ? 'Create new' : 'Auto'}
          </button>
        ))}
      </div>
      {mode === 'existing' && (
        <select
          className={selectClass}
          value={clientId}
          onChange={(e) => onClientIdChange(e.target.value)}
          required
        >
          <option value="">Select client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
          ))}
        </select>
      )}
      {mode === 'auto' && autoLabel && (
        <p className="text-xs text-charcoal/60 border border-cream-dark p-3">{autoLabel}</p>
      )}
      {mode === 'new' && (
        <div className="space-y-3 border border-cream-dark p-3">
          <input
            className={inputClass}
            placeholder="Full name"
            value={newClient.name}
            onChange={(e) => onNewClientChange({ ...newClient, name: e.target.value })}
            required
          />
          <input
            type="email"
            className={inputClass}
            placeholder="Email (login)"
            value={newClient.email}
            onChange={(e) => onNewClientChange({ ...newClient, email: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              className={inputClass}
              placeholder="Phone"
              value={newClient.phone || ''}
              onChange={(e) => onNewClientChange({ ...newClient, phone: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="City"
              value={newClient.city || ''}
              onChange={(e) => onNewClientChange({ ...newClient, city: e.target.value })}
            />
          </div>
          <input
            className={inputClass}
            placeholder="Address"
            value={newClient.address || ''}
            onChange={(e) => onNewClientChange({ ...newClient, address: e.target.value })}
          />
          <input
            type="password"
            className={inputClass}
            placeholder="Temporary password (min 6 chars)"
            value={newClient.password}
            onChange={(e) => onNewClientChange({ ...newClient, password: e.target.value })}
            required
            minLength={6}
          />
          <p className="text-[10px] text-charcoal/40">Creates client profile and login account.</p>
        </div>
      )}
    </FormField>
  );
}

export const emptyNewDesigner = (): CreateDesignerInput => ({
  name: '',
  firm: '',
  email: '',
  phone: '',
  city: '',
  password: '',
});

export const emptyNewClient = (): CreateClientInput => ({
  name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  password: '',
});

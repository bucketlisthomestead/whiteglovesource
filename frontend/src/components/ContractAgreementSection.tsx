import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Download,
  FileText,
  Loader2,
  PenLine,
  Upload,
  AlertCircle,
} from 'lucide-react';
import type { ContractProposal, ContractSignerRole, Project } from '../types';
import {
  captureContractSignature,
  downloadContractProposal,
  downloadSignedContract,
  generateProjectContract,
  getProjectContract,
  uploadSignedContract,
} from '../api/client';
import { SignaturePad, type SignaturePadHandle } from './SignaturePad';
import { useAuth } from '../context/AuthContext';
import { PERMISSIONS } from '../lib/permissions';
import { formatDate } from '../lib/labels';

const STATUS_LABELS: Record<ContractProposal['status'], string> = {
  draft: 'Draft',
  sent: 'Sent',
  signed: 'Signed',
};

interface ContractAgreementSectionProps {
  project: Project;
}

export function ContractAgreementSection({ project }: ContractAgreementSectionProps) {
  const { user, isAdmin, isDesigner, isClient, hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.PROJECTS_MANAGE);
  const [contract, setContract] = useState<ContractProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const adminPadRef = useRef<SignaturePadHandle>(null);
  const clientPadRef = useRef<SignaturePadHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    setError('');
    getProjectContract(project.id)
      .then((data) => setContract(data))
      .catch(() => setError('Unable to load contract'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [project.id]);

  const readOnly = contract?.isFullySigned ?? false;

  const handleGenerate = async () => {
    setBusy('generate');
    setError('');
    try {
      const updated = await generateProjectContract(project.id);
      setContract(updated);
    } catch {
      setError('Failed to generate proposal.');
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadProposal = async () => {
    setBusy('proposal');
    try {
      const blob = await downloadContractProposal(project.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = contract?.proposalFilename || 'contract-proposal.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Download failed.');
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadSigned = async () => {
    setBusy('signed');
    try {
      const blob = await downloadSignedContract(project.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = contract?.signedUploadFilename || 'signed-agreement';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Download failed.');
    } finally {
      setBusy(null);
    }
  };

  const handleUpload = async (file: File) => {
    setBusy('upload');
    setError('');
    try {
      const updated = await uploadSignedContract(project.id, file);
      setContract(updated);
    } catch {
      setError('Upload failed. Use PDF, JPEG, PNG, or WebP under 15 MB.');
    } finally {
      setBusy(null);
    }
  };

  const handleSign = async (role: ContractSignerRole, padRef: React.RefObject<SignaturePadHandle | null>) => {
    if (!user || !padRef.current) return;
    const dataUrl = padRef.current.toDataUrl();
    if (!dataUrl) {
      setError('Please draw your signature first.');
      return;
    }
    setBusy(`sign-${role}`);
    setError('');
    try {
      const updated = await captureContractSignature(project.id, {
        role,
        signerName: user.name,
        signatureDataUrl: dataUrl,
      });
      setContract(updated);
      padRef.current.clear();
    } catch {
      setError('Signature capture failed.');
    } finally {
      setBusy(null);
    }
  };

  const canSignAsAdmin = isAdmin || isDesigner;
  const canSignAsClient = isClient || isAdmin;
  const adminSigned = !!contract?.signatureMetadata?.admin;
  const clientSigned = !!contract?.signatureMetadata?.client;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-charcoal/50 justify-center">
        <Loader2 size={16} className="animate-spin" /> Loading contract…
      </div>
    );
  }

  return (
    <div className="bg-white border border-cream-dark p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm uppercase tracking-wider font-medium text-charcoal flex items-center gap-2">
            <FileText size={16} className="text-gold" />
            Contract & Agreement
          </h2>
          <p className="text-xs text-charcoal/50 mt-1">
            Service proposal and signed agreement for this project.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {contract && (
            <StatusBadge label={STATUS_LABELS[contract.status]} variant={contract.isFullySigned ? 'success' : 'neutral'} />
          )}
        </div>
      </div>

      {error && (
        <p className="mb-4 px-3 py-2 bg-red-50 text-red-800 text-xs border border-red-200 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </p>
      )}

      {!contract && (
        <div className="text-center py-8 border border-dashed border-cream-dark">
          <p className="text-sm text-charcoal/50 mb-4">No contract proposal yet.</p>
          {canManage && (
            <button
              type="button"
              disabled={busy === 'generate'}
              onClick={() => void handleGenerate()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-charcoal text-cream text-xs uppercase tracking-wider min-h-[44px] hover:bg-charcoal/90 disabled:opacity-50"
            >
              {busy === 'generate' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              Generate Proposal
            </button>
          )}
        </div>
      )}

      {contract && (
        <div className="space-y-6">
          <section>
            <h3 className="text-xs uppercase tracking-wider text-charcoal/50 mb-2">Proposal Document</h3>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {contract.hasProposal ? (
                <>
                  <span className="text-sm text-charcoal">{contract.proposalFilename}</span>
                  {contract.generatedByName && (
                    <span className="text-xs text-charcoal/40">by {contract.generatedByName}</span>
                  )}
                  <button
                    type="button"
                    disabled={busy === 'proposal'}
                    onClick={() => void handleDownloadProposal()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-gold min-h-[40px] hover:underline disabled:opacity-50"
                  >
                    {busy === 'proposal' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    Download
                  </button>
                </>
              ) : (
                <span className="text-sm text-charcoal/50">Not generated</span>
              )}
              {canManage && !readOnly && (
                <button
                  type="button"
                  disabled={busy === 'generate'}
                  onClick={() => void handleGenerate()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-charcoal text-cream text-xs min-h-[40px] hover:bg-charcoal/90 disabled:opacity-50"
                >
                  {busy === 'generate' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                  {contract.hasProposal ? 'Regenerate' : 'Generate'}
                </button>
              )}
            </div>
          </section>

          <section className="pt-4 border-t border-cream-dark">
            <h3 className="text-xs uppercase tracking-wider text-charcoal/50 mb-2">Signed Agreement</h3>
            {readOnly ? (
              <div className="space-y-2">
                {contract.hasSignedUpload && (
                  <div className="flex items-center gap-2 text-sm text-emerald-800">
                    <Check size={14} />
                    Uploaded: {contract.signedUploadFilename}
                    <button
                      type="button"
                      onClick={() => void handleDownloadSigned()}
                      className="text-gold text-xs hover:underline ml-2"
                    >
                      Download
                    </button>
                  </div>
                )}
                {adminSigned && (
                  <p className="text-sm text-emerald-800 flex items-center gap-2">
                    <Check size={14} />
                    Business — {contract.signatureMetadata!.admin!.name} ·{' '}
                    {formatDate(contract.signatureMetadata!.admin!.signedAt.slice(0, 10))}
                  </p>
                )}
                {clientSigned && (
                  <p className="text-sm text-emerald-800 flex items-center gap-2">
                    <Check size={14} />
                    Client — {contract.signatureMetadata!.client!.name} ·{' '}
                    {formatDate(contract.signatureMetadata!.client!.signedAt.slice(0, 10))}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-charcoal/60 mb-2">Upload a signed PDF or image (both parties)</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleUpload(file);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    disabled={!contract.hasProposal || busy === 'upload'}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-cream-dark bg-cream text-xs min-h-[44px] hover:bg-cream/80 disabled:opacity-50"
                  >
                    {busy === 'upload' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    Upload Signed Agreement
                  </button>
                </div>

                {contract.allowDigitalSignatures && contract.hasProposal && (
                  <div className="space-y-4 pt-2">
                    <p className="text-xs text-charcoal/60">Or sign digitally below (both parties required)</p>

                    <SignatureBlock
                      label="Business Representative"
                      signed={adminSigned}
                      signedEntry={contract.signatureMetadata?.admin}
                      canSign={canSignAsAdmin && !adminSigned}
                      busy={busy === 'sign-admin'}
                      padRef={adminPadRef}
                      onSign={() => void handleSign('admin', adminPadRef)}
                    />

                    <SignatureBlock
                      label="Client"
                      signed={clientSigned}
                      signedEntry={contract.signatureMetadata?.client}
                      canSign={canSignAsClient && !clientSigned}
                      busy={busy === 'sign-client'}
                      padRef={clientPadRef}
                      onSign={() => void handleSign('client', clientPadRef)}
                    />
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  label,
  variant,
}: {
  label: string;
  variant: 'success' | 'neutral';
}) {
  const cls =
    variant === 'success'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : 'bg-cream text-charcoal/70 border-cream-dark';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase tracking-wider border ${cls}`}>
      {variant === 'success' ? <Check size={12} /> : null}
      {label}
    </span>
  );
}

function SignatureBlock({
  label,
  signed,
  signedEntry,
  canSign,
  busy,
  padRef,
  onSign,
}: {
  label: string;
  signed: boolean;
  signedEntry?: { name: string; signedAt: string };
  canSign: boolean;
  busy: boolean;
  padRef: React.RefObject<SignaturePadHandle | null>;
  onSign: () => void;
}) {
  if (signed && signedEntry) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-800 text-sm">
        <Check size={14} />
        {label} — {signedEntry.name} · {formatDate(signedEntry.signedAt.slice(0, 10))}
      </div>
    );
  }

  if (!canSign) {
    return (
      <div className="px-3 py-2 bg-cream text-charcoal/40 text-xs border border-cream-dark">
        {label} signature pending
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-charcoal/70 mb-2">{label}</p>
      <SignaturePad ref={padRef} />
      <button
        type="button"
        disabled={busy}
        onClick={onSign}
        className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 bg-charcoal text-cream text-xs min-h-[40px] hover:bg-charcoal/90 disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <PenLine size={14} />}
        Sign as {label}
      </button>
    </div>
  );
}

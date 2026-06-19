import type { Project } from '../types';
import {
  PHASE_ORDER,
  PHASE_LABELS,
  PHASE_DESCRIPTIONS,
  STATUS_TO_PHASE,
  PROJECT_STATUS_LABELS,
  nextProjectStatus,
  JOB_TYPE_LABELS,
  JOB_STATUS_LABELS,
  CREW_ROLE_LABELS,
  INSTALL_DEST_LABELS,
  JOB_STATUS_COLORS,
  formatDate,
  formatTime,
} from '../lib/labels';
import { Check, MapPin, Truck, Calendar, Users, ClipboardList, ArrowRight, Loader2 } from 'lucide-react';

export function ProjectPhaseTimeline({
  project,
  showAdvance,
  onAdvance,
  advancing,
}: {
  project: Project;
  showAdvance?: boolean;
  onAdvance?: () => void;
  advancing?: boolean;
}) {
  const currentPhase = STATUS_TO_PHASE[project.status];
  const nextStatus = nextProjectStatus(project.status);

  return (
    <div className="bg-white border border-cream-dark p-4 md:p-6 mb-6">
      <p className="text-[10px] uppercase tracking-wider text-charcoal/40 mb-4">Project Workflow</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {PHASE_ORDER.map((phase, i) => {
          const isActive = currentPhase === phase;
          const isPast = currentPhase ? PHASE_ORDER.indexOf(currentPhase) > i : project.status === 'complete';
          const count = project.stats.phaseSummary?.[phase] ?? 0;

          return (
            <div
              key={phase}
              className={`relative p-4 border ${
                isActive ? 'border-gold bg-gold/5' : isPast ? 'border-emerald-200 bg-emerald-50/50' : 'border-cream-dark'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                    isPast ? 'bg-emerald-600 text-white' : isActive ? 'bg-gold text-charcoal' : 'bg-cream-dark text-charcoal/40'
                  }`}
                >
                  {isPast ? <Check size={14} /> : i + 1}
                </span>
                <span className="text-sm font-medium">{PHASE_LABELS[phase]}</span>
              </div>
              <p className="text-xs text-charcoal/50 leading-relaxed mb-2">{PHASE_DESCRIPTIONS[phase]}</p>
              <p className="text-xs text-charcoal/40">{count} piece{count !== 1 ? 's' : ''}</p>
              {isActive && (
                <span className="absolute top-3 right-3 text-[9px] uppercase tracking-wider text-gold font-medium">
                  Current
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-cream-dark grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {project.planningCompletedDate && (
          <div>
            <p className="text-charcoal/40 uppercase tracking-wider text-[10px]">Planning Done</p>
            <p className="text-charcoal/80">{formatDate(project.planningCompletedDate)}</p>
          </div>
        )}
        {project.pickupWindowStart && (
          <div>
            <p className="text-charcoal/40 uppercase tracking-wider text-[10px]">Pickup Window</p>
            <p className="text-charcoal/80">
              {formatDate(project.pickupWindowStart)} – {formatDate(project.pickupWindowEnd)}
            </p>
          </div>
        )}
        {project.targetInstallDate && (
          <div>
            <p className="text-charcoal/40 uppercase tracking-wider text-[10px]">Install Date</p>
            <p className="text-charcoal/80">{formatDate(project.targetInstallDate)}</p>
          </div>
        )}
        <div>
          <p className="text-charcoal/40 uppercase tracking-wider text-[10px]">Status</p>
          <p className="text-charcoal/80">{PROJECT_STATUS_LABELS[project.status]}</p>
        </div>
      </div>

      {showAdvance && nextStatus && onAdvance && (
        <div className="mt-4 pt-4 border-t border-cream-dark">
          <button
            type="button"
            onClick={onAdvance}
            disabled={advancing}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-charcoal text-cream text-xs uppercase tracking-wider min-h-[44px] disabled:opacity-50"
          >
            {advancing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ArrowRight size={14} />
            )}
            Advance to {PROJECT_STATUS_LABELS[nextStatus]}
          </button>
        </div>
      )}
    </div>
  );
}

export function StagingPlanSection({ project }: { project: Project }) {
  if (!project.stagingPlanOverview && !project.rooms.some((r) => r.notes)) return null;

  return (
    <div className="bg-white border border-cream-dark p-4 md:p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList size={16} className="text-gold" />
        <h2 className="text-sm uppercase tracking-wider font-medium">Staging Plan</h2>
      </div>

      {project.stagingPlanOverview && (
        <p className="text-sm text-charcoal/70 leading-relaxed mb-4">{project.stagingPlanOverview}</p>
      )}

      <div className="space-y-3">
        {project.rooms.map((room) => {
          const roomPieces = project.pieces.filter((p) => p.roomId === room.id);
          return (
            <div key={room.id} className="border border-cream-dark p-3">
              <p className="text-sm font-medium mb-1">{room.name}</p>
              {room.notes && <p className="text-xs text-charcoal/50 mb-2">{room.notes}</p>}
              <ul className="space-y-2">
                {roomPieces.map((piece) => (
                  <li key={piece.id} className="text-xs text-charcoal/70 flex flex-col sm:flex-row sm:gap-2">
                    <span className="font-medium text-charcoal/80 shrink-0">{piece.name}</span>
                    {piece.stagingNotes && (
                      <span className="text-charcoal/50">— {piece.stagingNotes}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {project.showroomAddress && (
        <p className="mt-4 text-xs text-charcoal/40">
          Showroom option: {project.showroomAddress}
        </p>
      )}
    </div>
  );
}

export function PickupLocationsSection({ project }: { project: Project }) {
  const locations = project.pickupLocations;
  if (!locations?.length) return null;

  return (
    <div className="bg-white border border-cream-dark p-4 md:p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <MapPin size={16} className="text-gold" />
        <h2 className="text-sm uppercase tracking-wider font-medium">Pickup Locations</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {locations.map((loc) => {
          const pieceCount = project.pieces.filter((p) => p.pickupLocationId === loc.id).length;
          return (
            <div key={loc.id} className="border border-cream-dark p-3">
              <p className="text-sm font-medium">{loc.name}</p>
              <p className="text-xs text-charcoal/50 mt-1">{loc.address}, {loc.city}</p>
              {loc.contactName && (
                <p className="text-xs text-charcoal/40 mt-1">{loc.contactName} · {loc.contactPhone}</p>
              )}
              {loc.notes && <p className="text-xs text-charcoal/40 mt-2 italic">{loc.notes}</p>}
              <p className="text-[10px] uppercase tracking-wider text-gold mt-2">{pieceCount} pieces</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ScheduleSection({ project }: { project: Project }) {
  const jobs = project.scheduledJobs;
  if (!jobs?.length) return null;

  return (
    <div className="bg-white border border-cream-dark p-4 md:p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Truck size={16} className="text-gold" />
          <h2 className="text-sm uppercase tracking-wider font-medium">Crew Schedule</h2>
        </div>
        {project.stats.upcomingJobs != null && project.stats.upcomingJobs > 0 && (
          <span className="text-xs text-charcoal/50">{project.stats.upcomingJobs} upcoming</span>
        )}
      </div>

      <div className="space-y-3">
        {jobs.map((job) => (
          <div key={job.id} className="border border-cream-dark p-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <p className="text-sm font-medium">{job.title}</p>
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${JOB_STATUS_COLORS[job.status]}`}>
                    {JOB_STATUS_LABELS[job.status]}
                  </span>
                </div>
                <p className="text-xs text-gold">{JOB_TYPE_LABELS[job.jobType]}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-charcoal/60 shrink-0">
                <Calendar size={12} />
                {formatDate(job.scheduledDate)}
                {job.startTime && ` · ${formatTime(job.startTime)}`}
                {job.endTime && ` – ${formatTime(job.endTime)}`}
              </div>
            </div>

            <p className="text-xs text-charcoal/50 flex items-start gap-1.5 mb-2">
              <MapPin size={12} className="mt-0.5 shrink-0" />
              {job.locationAddress}
              {job.destinationType && (
                <span className="text-charcoal/40"> · {INSTALL_DEST_LABELS[job.destinationType]}</span>
              )}
            </p>

            {job.notes && <p className="text-xs text-charcoal/40 mb-2">{job.notes}</p>}

            {job.pieceIds && job.pieceIds.length > 0 && (
              <p className="text-[10px] text-charcoal/40 mb-2">{job.pieceIds.length} pieces assigned</p>
            )}

            {job.assignments && job.assignments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-cream-dark">
                <Users size={12} className="text-charcoal/30 mt-1" />
                {job.assignments.map((a) => (
                  <span
                    key={a.id}
                    className="text-[10px] uppercase tracking-wider px-2 py-1 bg-cream-dark text-charcoal/70"
                  >
                    {CREW_ROLE_LABELS[a.assignmentRole]}: {a.crewMember.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

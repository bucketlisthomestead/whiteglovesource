import { Repository } from 'typeorm';
import { PickupLocation } from '../entities/pickup-location.entity';
import { CrewMember } from '../entities/crew-member.entity';
import { ScheduledJob } from '../entities/scheduled-job.entity';
import { JobAssignment } from '../entities/job-assignment.entity';
import { Piece } from '../entities/piece.entity';
import {
  CrewRole,
  InstallDestination,
  JobStatus,
  JobType,
  ProjectStatus,
} from '../common/enums';

export async function seedCrewIfNeeded(crewRepo: Repository<CrewMember>) {
  const count = await crewRepo.count();
  if (count > 0) return crewRepo.find();

  return crewRepo.save([
    {
      name: 'Marcus Reid',
      role: CrewRole.DRIVER,
      phone: '(336) 555-0201',
      email: 'marcus@whiteglovedeliverync.com',
    },
    {
      name: 'Tyler Boone',
      role: CrewRole.MOVER,
      phone: '(336) 555-0202',
      email: 'tyler@whiteglovedeliverync.com',
    },
    {
      name: 'James Holloway',
      role: CrewRole.LEAD,
      phone: '(336) 555-0203',
      email: 'james@whiteglovedeliverync.com',
    },
    {
      name: 'Derek Walsh',
      role: CrewRole.INSTALLER,
      phone: '(336) 555-0204',
      email: 'derek@whiteglovedeliverync.com',
    },
    {
      name: 'Nina Carter',
      role: CrewRole.WAREHOUSE,
      phone: '(336) 555-0205',
      email: 'nina@whiteglovedeliverync.com',
    },
    {
      name: 'Chris Ortiz',
      role: CrewRole.DRIVER,
      phone: '(336) 555-0206',
      email: 'chris@whiteglovedeliverync.com',
    },
  ]);
}

export async function seedDemoOperations(
  pickupRepo: Repository<PickupLocation>,
  jobRepo: Repository<ScheduledJob>,
  assignmentRepo: Repository<JobAssignment>,
  pieceRepo: Repository<Piece>,
  crew: CrewMember[],
  projectId: string,
) {
  const existingJobs = await jobRepo.count({ where: { projectId } });
  if (existingJobs > 0) return;

  const existingPickups = await pickupRepo.count({ where: { projectId } });
  if (existingPickups > 0) {
    await pickupRepo.delete({ projectId });
  }

  const crewByName = Object.fromEntries(crew.map((c) => [c.name, c]));

  const locations = await pickupRepo.save([
    {
      projectId,
      name: 'Bernhardt Showroom — High Point',
      address: '4075 Berhardt Blvd',
      city: 'High Point, NC',
      contactName: 'Receiving Desk',
      contactPhone: '(336) 555-8801',
      vendor: 'Bernhardt',
      notes: 'Loading dock B — call 30 min ahead',
    },
    {
      projectId,
      name: 'Century Furniture DC',
      address: '1800 20th St NE',
      city: 'Hickory, NC',
      contactName: 'Warehouse Manager',
      contactPhone: '(828) 555-4420',
      vendor: 'Century Furniture',
      notes: 'Sectional crate — forklift required',
    },
    {
      projectId,
      name: 'Theodore Alexander Warehouse',
      address: '2200 Furniture Ave',
      city: 'High Point, NC',
      contactName: 'Dispatch',
      contactPhone: '(336) 555-3310',
      vendor: 'Theodore Alexander',
      notes: 'Dining set on 10-day hold',
    },
    {
      projectId,
      name: 'Client Garage Hold',
      address: '1842 Lakeview Drive',
      city: 'Greensboro, NC',
      contactName: 'Catherine Morrison',
      contactPhone: '(336) 555-0198',
      vendor: 'Various',
      notes: 'Rug and lamp already on site — pickup for storage',
    },
  ]);

  const locMap = Object.fromEntries(
    locations.map((l) => [l.vendor || l.name, l.id]),
  );
  const pieces = await pieceRepo.find({ where: { projectId } });
  const pieceIdsByVendor = (vendor: string) =>
    pieces.filter((p) => p.vendor === vendor).map((p) => p.id);

  const jobs: ScheduledJob[] = [];
  for (const data of [
    {
      projectId,
      title: 'Pickup Run A — Bernhardt Bedroom',
      jobType: JobType.PICKUP,
      status: JobStatus.COMPLETE,
      scheduledDate: '2026-06-12',
      startTime: '08:00',
      endTime: '11:30',
      locationAddress: '4075 Berhardt Blvd, High Point, NC',
      locationCity: 'High Point, NC',
      pickupLocationId: locMap['Bernhardt'],
      pieceIds: pieceIdsByVendor('Bernhardt'),
      notes: 'Cal king, nightstands, dresser — blanket wrap all items',
    },
    {
      projectId,
      title: 'Pickup Run B — Century Sectional',
      jobType: JobType.PICKUP,
      status: JobStatus.SCHEDULED,
      scheduledDate: '2026-06-20',
      startTime: '07:30',
      endTime: '10:00',
      locationAddress: '1800 20th St NE, Hickory, NC',
      locationCity: 'Hickory, NC',
      pickupLocationId: locMap['Century Furniture'],
      pieceIds: pieceIdsByVendor('Century Furniture'),
      notes: 'Custom linen sectional — two-person team, lift gate truck',
    },
    {
      projectId,
      title: 'Pickup Run C — Theodore Alexander Dining',
      jobType: JobType.PICKUP,
      status: JobStatus.SCHEDULED,
      scheduledDate: '2026-06-22',
      startTime: '09:00',
      endTime: '12:00',
      locationAddress: '2200 Furniture Ave, High Point, NC',
      locationCity: 'High Point, NC',
      pickupLocationId: locMap['Theodore Alexander'],
      pieceIds: pieceIdsByVendor('Theodore Alexander'),
      notes: 'Table + 10 chairs — crate separately',
    },
    {
      projectId,
      title: 'Storage Intake & Condition Verify',
      jobType: JobType.STORAGE_INTAKE,
      status: JobStatus.IN_PROGRESS,
      scheduledDate: '2026-06-19',
      startTime: '13:00',
      endTime: '17:00',
      locationAddress: 'WGS Climate-Controlled Warehouse, High Point, NC',
      locationCity: 'High Point, NC',
      destinationType: InstallDestination.FINAL_SITE,
      pieceIds: pieces
        .filter((p) =>
          ['received', 'inspected', 'stored'].includes(p.currentStage),
        )
        .map((p) => p.id),
      notes: 'Photo document all incoming pieces — assign rack locations',
    },
    {
      projectId,
      title: 'Warehouse Staging — Install Sequence',
      jobType: JobType.WAREHOUSE_STAGING,
      status: JobStatus.SCHEDULED,
      scheduledDate: '2026-06-25',
      startTime: '08:00',
      endTime: '12:00',
      locationAddress: 'WGS Staging Bay B, High Point, NC',
      locationCity: 'High Point, NC',
      pieceIds: pieces
        .filter((p) => ['stored', 'staged'].includes(p.currentStage))
        .map((p) => p.id),
      notes: 'Sequence pieces by room install order per staging plan',
    },
    {
      projectId,
      title: 'Final Install — Morrison Lake House',
      jobType: JobType.FINAL_INSTALL,
      status: JobStatus.SCHEDULED,
      scheduledDate: '2026-06-28',
      startTime: '07:00',
      endTime: '18:00',
      locationAddress: '1842 Lakeview Drive',
      locationCity: 'Greensboro, NC',
      destinationType: InstallDestination.FINAL_SITE,
      pieceIds: pieces.map((p) => p.id),
      notes: 'Full crew — designer on-site 9 AM. Primary bath tub first.',
    },
  ]) {
    jobs.push(await jobRepo.save(jobRepo.create(data)));
  }

  const jobMap = Object.fromEntries(jobs.map((j) => [j.title, j.id]));

  await assignmentRepo.save([
    {
      jobId: jobMap['Pickup Run A — Bernhardt Bedroom'],
      crewMemberId: crewByName['Marcus Reid'].id,
      assignmentRole: CrewRole.DRIVER,
    },
    {
      jobId: jobMap['Pickup Run A — Bernhardt Bedroom'],
      crewMemberId: crewByName['Tyler Boone'].id,
      assignmentRole: CrewRole.MOVER,
    },
    {
      jobId: jobMap['Pickup Run A — Bernhardt Bedroom'],
      crewMemberId: crewByName['James Holloway'].id,
      assignmentRole: CrewRole.LEAD,
    },
    {
      jobId: jobMap['Pickup Run B — Century Sectional'],
      crewMemberId: crewByName['Chris Ortiz'].id,
      assignmentRole: CrewRole.DRIVER,
    },
    {
      jobId: jobMap['Pickup Run B — Century Sectional'],
      crewMemberId: crewByName['Tyler Boone'].id,
      assignmentRole: CrewRole.MOVER,
    },
    {
      jobId: jobMap['Pickup Run B — Century Sectional'],
      crewMemberId: crewByName['James Holloway'].id,
      assignmentRole: CrewRole.LEAD,
    },
    {
      jobId: jobMap['Pickup Run C — Theodore Alexander Dining'],
      crewMemberId: crewByName['Marcus Reid'].id,
      assignmentRole: CrewRole.DRIVER,
    },
    {
      jobId: jobMap['Pickup Run C — Theodore Alexander Dining'],
      crewMemberId: crewByName['Tyler Boone'].id,
      assignmentRole: CrewRole.MOVER,
    },
    {
      jobId: jobMap['Storage Intake & Condition Verify'],
      crewMemberId: crewByName['Nina Carter'].id,
      assignmentRole: CrewRole.WAREHOUSE,
    },
    {
      jobId: jobMap['Storage Intake & Condition Verify'],
      crewMemberId: crewByName['James Holloway'].id,
      assignmentRole: CrewRole.LEAD,
    },
    {
      jobId: jobMap['Warehouse Staging — Install Sequence'],
      crewMemberId: crewByName['Nina Carter'].id,
      assignmentRole: CrewRole.WAREHOUSE,
    },
    {
      jobId: jobMap['Warehouse Staging — Install Sequence'],
      crewMemberId: crewByName['Derek Walsh'].id,
      assignmentRole: CrewRole.INSTALLER,
    },
    {
      jobId: jobMap['Final Install — Morrison Lake House'],
      crewMemberId: crewByName['Marcus Reid'].id,
      assignmentRole: CrewRole.DRIVER,
    },
    {
      jobId: jobMap['Final Install — Morrison Lake House'],
      crewMemberId: crewByName['Chris Ortiz'].id,
      assignmentRole: CrewRole.DRIVER,
    },
    {
      jobId: jobMap['Final Install — Morrison Lake House'],
      crewMemberId: crewByName['Tyler Boone'].id,
      assignmentRole: CrewRole.MOVER,
    },
    {
      jobId: jobMap['Final Install — Morrison Lake House'],
      crewMemberId: crewByName['Derek Walsh'].id,
      assignmentRole: CrewRole.INSTALLER,
    },
    {
      jobId: jobMap['Final Install — Morrison Lake House'],
      crewMemberId: crewByName['James Holloway'].id,
      assignmentRole: CrewRole.LEAD,
    },
  ]);

  // Link pieces to pickup locations and add staging notes
  const stagingNotes: Record<
    string,
    { pickupVendor?: string; notes: string; dest?: InstallDestination }
  > = {
    'Cal King Upholstered Bed': {
      pickupVendor: 'Bernhardt',
      notes: 'Center on east wall, 24" clearance both sides',
      dest: InstallDestination.FINAL_SITE,
    },
    'Nightstand (Pair)': {
      pickupVendor: 'Bernhardt',
      notes: 'Flank bed — left has drawer charging port',
      dest: InstallDestination.FINAL_SITE,
    },
    'Dresser & Mirror': {
      pickupVendor: 'Bernhardt',
      notes: 'Dresser on south wall, mirror centered above',
      dest: InstallDestination.FINAL_SITE,
    },
    'Sectional Sofa — Custom Linen': {
      pickupVendor: 'Century Furniture',
      notes: 'Facing lake windows — left-arm chaise orientation',
      dest: InstallDestination.FINAL_SITE,
    },
    'Marble Coffee Table': {
      pickupVendor: 'Arteriors',
      notes: '18" from sectional — protect marble on install',
      dest: InstallDestination.FINAL_SITE,
    },
    'Floor Lamp — Brass Arc': {
      pickupVendor: 'Visual Comfort',
      notes: 'Behind sectional left corner',
      dest: InstallDestination.FINAL_SITE,
    },
    'Dining Table — 10ft Walnut': {
      pickupVendor: 'Theodore Alexander',
      notes: 'Centered under chandelier — 36" clearance',
      dest: InstallDestination.FINAL_SITE,
    },
    'Dining Chairs (10)': {
      pickupVendor: 'Theodore Alexander',
      notes: '5 per side, upholstered seats facing inward',
      dest: InstallDestination.FINAL_SITE,
    },
    'Chandelier — Hand-Blown Glass': {
      pickupVendor: 'Hubbardton Forge',
      notes: 'Install after table placed — electrician on call',
      dest: InstallDestination.FINAL_SITE,
    },
    'Executive Desk — Walnut': {
      pickupVendor: 'Hickory Chair',
      notes: 'Built-in niche north wall, cable management left',
      dest: InstallDestination.FINAL_SITE,
    },
    'Leather Desk Chair': {
      pickupVendor: 'Hickory Chair',
      notes: 'Facing lake view window',
      dest: InstallDestination.FINAL_SITE,
    },
    'Freestanding Soaking Tub': {
      pickupVendor: 'Victoria + Albert',
      notes: 'Centered on window wall — special rigging crew',
      dest: InstallDestination.FINAL_SITE,
    },
    'Vanity Console — Double': {
      pickupVendor: 'Robern',
      notes: 'Plumbing alignment critical — verify before install',
      dest: InstallDestination.FINAL_SITE,
    },
    'Area Rug — 9x12 Hand-Knotted': {
      pickupVendor: 'Stark Carpet',
      notes: 'Under coffee table — pad included in roll',
      dest: InstallDestination.FINAL_SITE,
    },
  };

  for (const piece of pieces) {
    const plan = stagingNotes[piece.name];
    if (!plan) continue;
    piece.stagingNotes = plan.notes;
    piece.installDestination = plan.dest || InstallDestination.FINAL_SITE;
    if (plan.pickupVendor) {
      const loc = locations.find((l) => l.vendor === plan.pickupVendor);
      if (loc) piece.pickupLocationId = loc.id;
    }
    await pieceRepo.save(piece);
  }
}

import { Project } from '../entities/project.entity';

export async function updateDemoProjectMeta(
  projectRepo: Repository<Project>,
  projectId: string,
) {
  await projectRepo.update(projectId, {
    status: ProjectStatus.PICKUP_STORAGE,
    planningCompletedDate: '2026-06-10',
    pickupWindowStart: '2026-06-12',
    pickupWindowEnd: '2026-06-24',
    targetInstallDate: '2026-06-28',
    stagingPlanOverview:
      'Full-home install sequenced room-by-room: Primary Bath (tub first) → Primary Bedroom → Living Room → Dining Room → Home Office. All pieces verified at intake before staging bay assignment. Designer walkthrough June 27.',
    primaryInstallDestination: InstallDestination.FINAL_SITE,
    showroomAddress:
      'Whitfield Interiors Showroom, 1200 N Main St, High Point, NC',
  });
}

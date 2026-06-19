import { Navigate, useParams } from 'react-router-dom';

/** Deep links → project inventory tab with labels section expanded. */
export function ProjectLabelsPrintRedirect() {
  const { projectId, id } = useParams<{ projectId?: string; id?: string }>();
  const resolvedId = projectId ?? id;
  if (!resolvedId) return <Navigate to="/projects" replace />;
  return <Navigate to={`/project/${encodeURIComponent(resolvedId)}?labels=1`} replace />;
}

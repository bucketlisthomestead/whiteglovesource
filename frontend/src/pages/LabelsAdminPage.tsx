import { Navigate, useSearchParams } from 'react-router-dom';
import { LabelsHubPage } from './LabelsHubPage';

/** Control panel labels: project picker; print view lives on a chrome-free route. */
export function LabelsAdminPage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project');

  if (projectId) {
    return <Navigate to={`/admin/labels/print/${encodeURIComponent(projectId)}`} replace />;
  }

  return <LabelsHubPage />;
}

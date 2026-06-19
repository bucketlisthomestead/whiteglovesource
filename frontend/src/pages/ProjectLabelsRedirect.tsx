import { Navigate, useParams } from 'react-router-dom';

/** Deep link: /project/:id/labels → control panel labels with project preselected. */
export function ProjectLabelsRedirect() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/admin/labels" replace />;
  return <Navigate to={`/admin/labels?project=${encodeURIComponent(id)}`} replace />;
}

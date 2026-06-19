import { useSearchParams } from 'react-router-dom';
import { LabelPrintPage } from './LabelPrintPage';
import { LabelsHubPage } from './LabelsHubPage';

/** Control panel labels: project picker or print view when ?project= is set. */
export function LabelsAdminPage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project');

  if (projectId) {
    return <LabelPrintPage projectId={projectId} />;
  }

  return <LabelsHubPage />;
}

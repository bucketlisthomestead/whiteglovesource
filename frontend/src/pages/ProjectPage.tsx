import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getDemoProject } from '../api/client';
import { ProjectPortal } from '../components/ProjectPortal';

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [demoId, setDemoId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getDemoProject()
      .then((demo) => setDemoId(demo.id))
      .catch(() => setDemoId(null))
      .finally(() => setChecking(false));
  }, []);

  if (checking) return null;

  if (id && demoId && id === demoId) {
    return <ProjectPortal isDemo />;
  }

  return <ProjectPortal projectId={id} />;
}

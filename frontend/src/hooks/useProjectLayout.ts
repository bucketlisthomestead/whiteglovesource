import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  type ProjectLayoutId,
  PROJECT_LAYOUT_PRESETS,
  getStoredProjectLayout,
  setStoredProjectLayout,
} from '../lib/projectLayout';

export function useProjectLayout() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [layoutId, setLayoutIdState] = useState<ProjectLayoutId>(() =>
    getStoredProjectLayout(userId),
  );

  useEffect(() => {
    setLayoutIdState(getStoredProjectLayout(userId));
  }, [userId]);

  const setLayoutId = useCallback(
    (next: ProjectLayoutId) => {
      setLayoutIdState(next);
      setStoredProjectLayout(next, userId);
    },
    [userId],
  );

  return {
    layoutId,
    setLayoutId,
    preset: PROJECT_LAYOUT_PRESETS[layoutId],
    presets: PROJECT_LAYOUT_PRESETS,
  };
}

import { useMemo, useState } from 'react';
import {
  rangeForPreset,
  type DashboardDateRange,
  type DateRangePreset,
} from '../lib/dashboardDates';

export function useDateRangeFilter(initialPreset: DateRangePreset = 'next6') {
  const [preset, setPreset] = useState<DateRangePreset>(initialPreset);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [appliedCustom, setAppliedCustom] = useState<DashboardDateRange | null>(null);

  const appliedRange = useMemo(() => {
    if (preset === 'custom') {
      return rangeForPreset('custom', appliedCustom);
    }
    return rangeForPreset(preset);
  }, [preset, appliedCustom]);

  const handlePresetChange = (next: DateRangePreset) => {
    if (next === 'custom') {
      const seed =
        preset === 'custom' && appliedCustom
          ? appliedCustom
          : rangeForPreset(preset === 'custom' ? 'next6' : preset);
      setCustomFrom(seed.from);
      setCustomTo(seed.to);
    }
    setPreset(next);
  };

  const applyCustom = () => {
    if (!customFrom || !customTo) return;
    const from = customFrom <= customTo ? customFrom : customTo;
    const to = customFrom <= customTo ? customTo : customFrom;
    setAppliedCustom({ from, to });
  };

  return {
    preset,
    handlePresetChange,
    customFrom,
    customTo,
    setCustomFrom,
    setCustomTo,
    applyCustom,
    appliedRange,
  };
}

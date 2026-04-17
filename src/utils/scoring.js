export const TRACK_POINTS_BY_POSITION = [100, 95, 90, 87, 84, 81];
export const DISPUTE_AUTO_SUBMIT_WINDOW_MS = 20 * 60 * 1000;
export const DISPUTE_AUTO_SUBMIT_POLL_MS = 5000;

export const parseRegistrationPayload = registration => {
  if (!registration || !registration.submission_json) {
    return registration || {};
  }

  try {
    return {
      ...registration,
      ...JSON.parse(registration.submission_json),
    };
  } catch (error) {
    return registration || {};
  }
};

export const parseStoredTimestamp = value => {
  if (!value) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const rawValue = String(value).trim();

  if (!rawValue) {
    return null;
  }

  const normalizedValue = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(rawValue)
    ? `${rawValue.replace(' ', 'T')}Z`
    : rawValue;
  const parsedValue = Date.parse(normalizedValue);

  return Number.isNaN(parsedValue) ? null : parsedValue;
};

export const formatCountdownLabel = milliseconds => {
  const safeMilliseconds = Math.max(0, milliseconds || 0);
  const totalSeconds = Math.ceil(safeMilliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const getDisputeAutoSubmitStatus = (dispute, now = Date.now()) => {
  const createdAtMs =
    parseStoredTimestamp(
      dispute?.created_at ||
        dispute?.createdAt ||
        dispute?.hold_created_at ||
        dispute?.holdCreatedAt ||
        dispute?.updated_at ||
        dispute?.updatedAt
    ) || now;
  const expiresAtMs = createdAtMs + DISPUTE_AUTO_SUBMIT_WINDOW_MS;
  const remainingMs = Math.max(0, expiresAtMs - now);

  return {
    createdAtMs,
    expiresAtMs,
    remainingMs,
    remainingLabel: formatCountdownLabel(remainingMs),
    isExpired: expiresAtMs <= now,
  };
};

export const normalizeValue = value => String(value || '').trim().toLowerCase();

export const normalizeDateValue = value =>
  normalizeValue(value)
    .replace(/(\d+)(st|nd|rd|th)\b/g, '$1')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeCategoryKey = value => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  if (normalized === 'LADIES' || normalized === 'LADIES_CATEGORY') {
    return 'LADIES_CATEGORY';
  }

  return normalized;
};

export const getDayIdentity = item => ({
  dayId: normalizeValue(item?.selected_day_id || item?.selectedDayId || item?.day_id || item?.dayId || ''),
  dayLabel: normalizeValue(
    item?.selected_day_label || item?.selectedDayLabel || item?.day_label || item?.dayLabel || ''
  ),
  dayDate: normalizeDateValue(
    item?.selected_day_date || item?.selectedDayDate || item?.day_date || item?.dayDate || ''
  ),
});

export const matchesSelectedDay = (item, selectedDay) => {
  if (!selectedDay?.id) {
    return false;
  }

  const itemDay = getDayIdentity(item);
  const selectedDayId = normalizeValue(selectedDay.id);
  const selectedDayLabel = normalizeValue(selectedDay.dayLabel);
  const selectedDayDate = normalizeDateValue(selectedDay.dateLabel);

  return (
    itemDay.dayId === selectedDayId ||
    itemDay.dayLabel === selectedDayLabel ||
    itemDay.dayDate === selectedDayDate
  );
};

export const getResultIdentityKey = item => {
  const dayIdentity = getDayIdentity(item);

  return [
    normalizeCategoryKey(item?.category),
    normalizeValue(item?.track_name || item?.trackName),
    normalizeValue(item?.sticker_number || item?.stickerNumber),
    normalizeValue(item?.driver_name || item?.driverName),
    dayIdentity.dayId || dayIdentity.dayLabel || dayIdentity.dayDate,
  ].join('|');
};

export const getNumericValue = value => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const matchedValue = String(value || '').match(/-?\d+/);
  return matchedValue ? Number(matchedValue[0]) : null;
};

export const parseTimeForSort = value => {
  const rawValue = String(value || '').trim();

  if (!rawValue || rawValue === '--' || rawValue.toUpperCase() === 'DNS') {
    return Number.POSITIVE_INFINITY;
  }

  if (rawValue.toUpperCase() === 'DISPUTED') {
    return Number.POSITIVE_INFINITY;
  }

  const parts = rawValue.split(':').map(part => Number(part));

  if (parts.some(part => Number.isNaN(part))) {
    return Number.POSITIVE_INFINITY;
  }

  if (parts.length === 3) {
    const [minutes, seconds, centiseconds] = parts;
    return minutes * 60000 + seconds * 1000 + centiseconds * 10;
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60000 + seconds * 1000;
  }

  return Number.POSITIVE_INFINITY;
};

export const isDnsResult = item => Boolean(item?.is_dns || item?.isDns);

export const isDnfResult = item => {
  if (Boolean(item?.is_dnf || item?.isDNF)) {
    return true;
  }

  const totalTimeValue = String(item?.total_time || item?.totalTimeDisplay || '').trim().toUpperCase();
  const completionTimeValue = String(item?.completion_time || item?.completionTime || '').trim().toUpperCase();
  return totalTimeValue.startsWith('DNF') || completionTimeValue === 'DNF';
};

export const getResultTimeValue = item =>
  parseTimeForSort(item?.total_time || item?.totalTimeDisplay || item?.performance_time || item?.performanceTimeDisplay);

export const getTrackPointsForPosition = position => {
  if (position <= 0) {
    return null;
  }

  if (position <= TRACK_POINTS_BY_POSITION.length) {
    return TRACK_POINTS_BY_POSITION[position - 1];
  }

  return TRACK_POINTS_BY_POSITION[TRACK_POINTS_BY_POSITION.length - 1] - (position - TRACK_POINTS_BY_POSITION.length);
};

export const getDnfPointsValue = item => {
  const directPoints = getNumericValue(item?.dnf_points ?? item?.dnfPoints);

  if (directPoints !== null) {
    return directPoints;
  }

  const selectedPoints = getNumericValue(item?.dnf_selection ?? item?.dnfSelection);
  return selectedPoints ?? 0;
};

export const getResultSortPriority = item => {
  if (item?.isDisputed) {
    return 3;
  }

  if (isDnsResult(item)) {
    return 2;
  }

  if (isDnfResult(item)) {
    return 1;
  }

  return 0;
};

export const compareResultsByRank = (a, b) => {
  const aPriority = getResultSortPriority(a);
  const bPriority = getResultSortPriority(b);

  if (aPriority !== bPriority) {
    return aPriority - bPriority;
  }

  const aTime = getResultTimeValue(a);
  const bTime = getResultTimeValue(b);

  if (aTime !== bTime) {
    return aTime - bTime;
  }

  return String(a?.sticker_number || a?.stickerNumber || '').localeCompare(
    String(b?.sticker_number || b?.stickerNumber || ''),
    undefined,
    { numeric: true }
  );
};

export const rankTrackResults = results => {
  const sortedResults = [...(results || [])].sort(compareResultsByRank);
  let finisherPosition = 0;

  return sortedResults.map(item => {
    if (item?.isDisputed) {
      return {
        ...item,
        reportRankLabel: 'Hold',
        reportPoints: null,
      };
    }

    if (isDnsResult(item)) {
      return {
        ...item,
        reportRankLabel: 'DNS',
        reportPoints: 0,
      };
    }

    if (isDnfResult(item)) {
      return {
        ...item,
        reportRankLabel: 'DNF',
        reportPoints: getDnfPointsValue(item),
      };
    }

    finisherPosition += 1;

    return {
      ...item,
      reportRankLabel: `P${finisherPosition}`,
      reportPoints: getTrackPointsForPosition(finisherPosition),
    };
  });
};

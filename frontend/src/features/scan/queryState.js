export function keepPreviousScanResults(previousData, previousQuery, scanId, filterKey) {
  const previousKey = previousQuery?.queryKey;
  const sameScan = previousKey?.[1] === scanId;
  const sameFilters = previousKey?.[6] === filterKey;
  return sameScan && sameFilters ? previousData : undefined;
}

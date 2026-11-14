export function officerEmptyCopy(area: string, filtered = false) {
  if (filtered)
    return {
      title: 'No matching records',
      description: 'Clear the filters to see all records in your assigned laboratories.',
    };
  const name = area.toLowerCase();
  if (name.includes('personal request'))
    return {
      title: 'No requests created by you',
      description: 'Create a borrowing request using the item-specific approval policy.',
    };
  if (name.includes('personal borrowing'))
    return {
      title: 'No equipment borrowed by you',
      description: 'Your issued equipment and expected return dates will appear here.',
    };
  if (name.includes('inspection'))
    return {
      title: 'No inspections waiting',
      description: 'Received equipment will appear here when it is ready for inspection.',
    };
  if (name.includes('return'))
    return {
      title: 'No returns outstanding',
      description: 'Equipment awaiting physical return will appear here.',
    };
  if (name.includes('handover') || name.includes('collection'))
    return {
      title: 'No handovers ready',
      description: 'Approved, reserved equipment will appear here for collection.',
    };
  if (name.includes('proposal'))
    return {
      title: 'No adjustment proposals',
      description: 'Proposals awaiting independent authorization will appear here.',
    };
  if (name.includes('import'))
    return {
      title: 'No receipt imports yet',
      description: 'Upload a receipt file above to validate and review its rows.',
    };
  if (name.includes('stock'))
    return {
      title: 'No stock recorded',
      description: 'Record a physical stock receipt to add equipment to an assigned laboratory.',
    };
  if (name.includes('inventory'))
    return {
      title: 'No inventory to display',
      description: 'Equipment in your authorized laboratories will appear here.',
    };
  return {
    title: 'No laboratory operations yet',
    description: 'Recorded lending and stock movements will appear here.',
  };
}
export function officerHasRows(rows: readonly unknown[]) {
  return rows.length > 0;
}

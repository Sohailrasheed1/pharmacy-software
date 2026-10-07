export function formatCurrency(paisa: number): string {
  const rs = Math.round(paisa / 100);
  return `Rs ${rs.toLocaleString('en-PK')}`;
}

export function formatExpiry(ym: string): string {
  if (!ym) return '';
  const [year, month] = ym.split('-');
  if (!year || !month) return ym;
  return `${month}/${year}`;
}

export function formatPacksAndLoose(units: number, packSize: number, form: string = 'tablet'): string {
  if (packSize <= 1) {
    return `${units} ${form}${units === 1 ? '' : 's'}`;
  }
  const packs = Math.floor(units / packSize);
  const loose = units % packSize;

  const packName = form === 'capsule' ? 'pack' : 'strip';
  if (packs === 0) {
    return `${loose} loose`;
  }
  if (loose === 0) {
    return `${packs} ${packName}${packs > 1 ? 's' : ''}`;
  }
  return `${packs} ${packName}${packs > 1 ? 's' : ''} + ${loose} loose`;
}

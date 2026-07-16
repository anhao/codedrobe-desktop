// SPDX-License-Identifier: MPL-2.0

const segments = [
  { rotation: 55, color: '#f0b94b' }, { rotation: 95, color: '#f8f7fc' },
  { rotation: 135, color: '#f8f7fc' }, { rotation: 180, color: '#f8f7fc' },
  { rotation: 225, color: '#f8f7fc' }, { rotation: 265, color: '#f8f7fc' },
  { rotation: 305, color: '#8174ff' },
] as const;

export function BrandSymbol({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 512 512" aria-hidden="true"><g fill="none" strokeWidth="70" strokeLinecap="round">
    {segments.map(({ rotation, color }) => <path key={rotation} d="M387.68 246.79A132 132 0 0 1 387.68 265.21" stroke={color} transform={`rotate(${rotation} 256 256)`}/>) }
  </g></svg>;
}

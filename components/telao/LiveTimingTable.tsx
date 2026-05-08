import type { CSSProperties } from 'react';
import type { LiveTimingDriver } from '@/lib/livetime/types';
import { driversByPosition } from '@/lib/livetime/layout';
import { DEFAULT_TELAO_LAYOUT, firstDriverName, type TelaoField, type TelaoLayoutConfig } from '@/lib/telao-layout-config';

type LiveTimingTableProps = {
  drivers: LiveTimingDriver[];
  layout?: TelaoLayoutConfig;
};

const FIELD_LABELS: Record<TelaoField, string> = {
  position: 'P',
  kart: '#',
  name: 'Nome',
  time: 'Time',
};

const FIELD_WEIGHTS: Record<TelaoField, number> = {
  position: 10,
  kart: 14,
  name: 42,
  time: 34,
};

function visibleFields(layout: TelaoLayoutConfig): TelaoField[] {
  return layout.fields.filter((field) => field !== 'name' || layout.nameMode !== 'hidden');
}

function positionForCell(layout: TelaoLayoutConfig, rowIndex: number, columnIndex: number): number {
  if (layout.variant === 'cards') return rowIndex * layout.columns + columnIndex + 1;
  return columnIndex * layout.rows + rowIndex + 1;
}

function fieldValue(field: TelaoField, position: number, driver?: LiveTimingDriver, layout = DEFAULT_TELAO_LAYOUT): string {
  if (field === 'position') return String(position);
  if (field === 'kart') return driver?.kart || '-';
  if (field === 'name') return firstDriverName(driver?.name, layout.nameMode);
  return driver?.time || '';
}

function tableStyle(layout: TelaoLayoutConfig): CSSProperties {
  return {
    '--display-groups': layout.columns,
    '--grid-color': layout.colors.grid,
    '--accent-color': layout.colors.accent,
    '--text-color': layout.colors.text,
    '--position-color': layout.colors.position,
    '--time-color': layout.colors.time,
    '--muted-color': layout.colors.muted,
    '--layout-border-width': `${layout.borderWidth}px`,
    '--header-font-size': `${layout.headerFontSize}px`,
    '--position-font-size': `${layout.positionFontSize}px`,
    '--kart-font-size': `${layout.kartFontSize}px`,
    '--name-font-size': `${layout.nameFontSize}px`,
    '--time-font-size': `${layout.timeFontSize}px`,
  } as CSSProperties;
}

function cardGridStyle(layout: TelaoLayoutConfig): CSSProperties {
  return {
    '--card-columns': layout.columns,
    '--card-rows': layout.rows,
    '--card-gap': `${layout.cellGap}px`,
    '--grid-color': layout.colors.grid,
    '--accent-color': layout.colors.accent,
    '--text-color': layout.colors.text,
    '--position-color': layout.colors.position,
    '--time-color': layout.colors.time,
    '--muted-color': layout.colors.muted,
    '--top-cell': layout.colors.topCell || layout.colors.background,
    '--bottom-cell': layout.colors.bottomCell || layout.colors.background,
    '--layout-border-width': `${layout.borderWidth}px`,
    '--position-font-size': `${layout.positionFontSize}px`,
    '--kart-font-size': `${layout.kartFontSize}px`,
    '--name-font-size': `${layout.nameFontSize}px`,
    '--time-font-size': `${layout.timeFontSize}px`,
  } as CSSProperties;
}

function TableDriverCells({ driver, layout, position }: { driver?: LiveTimingDriver; layout: TelaoLayoutConfig; position: number }) {
  const isLeader = position === 1 && Boolean(driver);
  const stateClass = driver ? 'driver-cells-filled' : 'driver-cells-empty';
  const leaderClass = isLeader ? 'driver-cells-leader' : '';
  const cellClass = `driver-cells ${stateClass} ${leaderClass}`.trim();

  return (
    <>
      {visibleFields(layout).map((field) => (
        <td key={field} className={`${cellClass} cell-${field}`} title={field === 'name' ? driver?.name || '' : undefined}>
          {fieldValue(field, position, driver, layout)}
        </td>
      ))}
    </>
  );
}

function TableLayout({ drivers, layout }: { drivers: LiveTimingDriver[]; layout: TelaoLayoutConfig }) {
  const mappedDrivers = driversByPosition(drivers);
  const fields = visibleFields(layout);
  const totalWeight = fields.reduce((sum, field) => sum + FIELD_WEIGHTS[field], 0);

  return (
    <table className={`livetime-table livetime-table-${layout.columns} livetime-rows-${layout.rows}`} aria-label="Classificacao ao vivo" style={tableStyle(layout)}>
      <colgroup>
        {Array.from({ length: layout.columns }, (_, groupIndex) =>
          fields.map((field) => (
            <col key={`${groupIndex}-${field}`} style={{ width: `${FIELD_WEIGHTS[field] / totalWeight / layout.columns * 100}%` }} />
          )),
        )}
      </colgroup>
      <thead>
        <tr>
          {Array.from({ length: layout.columns }, (_, groupIndex) =>
            fields.map((field) => (
              <th key={`${groupIndex}-${field}`} className={`head-${field}`}>
                {FIELD_LABELS[field]}
              </th>
            )),
          )}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: layout.rows }, (_, rowIndex) => (
          <tr key={rowIndex}>
            {Array.from({ length: layout.columns }, (_, columnIndex) => {
              const position = positionForCell(layout, rowIndex, columnIndex);
              return <TableDriverCells key={position} position={position} driver={mappedDrivers.get(position)} layout={layout} />;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CardLayout({ drivers, layout }: { drivers: LiveTimingDriver[]; layout: TelaoLayoutConfig }) {
  const mappedDrivers = driversByPosition(drivers);
  const fields = visibleFields(layout);

  return (
    <div className="livetime-card-grid" aria-label="Classificacao ao vivo" style={cardGridStyle(layout)}>
      {Array.from({ length: layout.rows }, (_, rowIndex) =>
        Array.from({ length: layout.columns }, (_, columnIndex) => {
          const position = positionForCell(layout, rowIndex, columnIndex);
          const driver = mappedDrivers.get(position);
          const isLeader = position === 1 && Boolean(driver);
          const className = `livetime-card ${driver ? 'livetime-card-filled' : 'livetime-card-empty'} ${isLeader ? 'livetime-card-leader' : ''}`.trim();

          return (
            <div key={position} className={className}>
              {fields.map((field) => (
                <span key={field} className={`card-field card-${field}`} title={field === 'name' ? driver?.name || '' : undefined}>
                  {fieldValue(field, position, driver, layout)}
                </span>
              ))}
            </div>
          );
        }),
      )}
    </div>
  );
}

export function LiveTimingTable({ drivers, layout = DEFAULT_TELAO_LAYOUT }: LiveTimingTableProps) {
  if (layout.variant === 'cards') return <CardLayout drivers={drivers} layout={layout} />;
  return <TableLayout drivers={drivers} layout={layout} />;
}

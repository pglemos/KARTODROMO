import type { CSSProperties } from 'react';
import type { LiveTimingDriver } from '@/lib/livetime/types';
import { driversByPosition, getPositionForCell, GROUP_COUNT, ROW_COUNT } from '@/lib/livetime/layout';

function firstName(name?: string): string {
  return name?.trim().split(/\s+/)[0] || '';
}

function DriverCells({ driver, position }: { driver?: LiveTimingDriver; position: number }) {
  const isLeader = position === 1 && Boolean(driver);
  const stateClass = driver ? 'driver-cells-filled' : 'driver-cells-empty';
  const leaderClass = isLeader ? 'driver-cells-leader' : '';
  const cellClass = `driver-cells ${stateClass} ${leaderClass}`.trim();

  return (
    <>
      <td className={`${cellClass} cell-pos`}>{position}</td>
      <td className={`${cellClass} cell-kart`}>{driver?.kart || '-'}</td>
      <td className={`${cellClass} cell-name`} title={driver?.name || ''}>
        {firstName(driver?.name)}
      </td>
      <td className={`${cellClass} cell-time`}>{driver?.time || ''}</td>
    </>
  );
}

export function LiveTimingTable({ drivers }: { drivers: LiveTimingDriver[] }) {
  const mappedDrivers = driversByPosition(drivers);

  return (
    <table
      className={`livetime-table livetime-table-${GROUP_COUNT} livetime-rows-${ROW_COUNT}`}
      aria-label="Classificacao ao vivo"
      style={{ '--display-groups': GROUP_COUNT } as CSSProperties}
    >
      <colgroup>
        {Array.from({ length: GROUP_COUNT }, (_, groupIndex) => (
          <FragmentCols key={groupIndex} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {Array.from({ length: GROUP_COUNT }, (_, groupIndex) => (
            <FragmentHeader key={groupIndex} />
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: ROW_COUNT }, (_, rowIndex) => (
          <tr key={rowIndex}>
            {Array.from({ length: GROUP_COUNT }, (_, groupIndex) => {
              const position = getPositionForCell(rowIndex, groupIndex);
              return <DriverCells key={position} position={position} driver={mappedDrivers.get(position)} />;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FragmentCols() {
  return (
    <>
      <col className="col-pos" />
      <col className="col-kart" />
      <col className="col-name" />
      <col className="col-time" />
    </>
  );
}

function FragmentHeader() {
  return (
    <>
      <th className="head-pos">P</th>
      <th className="head-kart">#</th>
      <th className="head-name">Nome</th>
      <th className="head-time">Time</th>
    </>
  );
}

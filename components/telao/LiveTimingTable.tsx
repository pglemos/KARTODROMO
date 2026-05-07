import type { LiveTimingDriver } from '@/lib/livetime/types';
import { driversByPosition, getPositionForCell, GROUP_COUNT, ROW_COUNT } from '@/lib/livetime/layout';

function DriverCells({ driver, position }: { driver?: LiveTimingDriver; position: number }) {
  const isLeader = position === 1;

  return (
    <>
      <td className="cell-pos">{position}</td>
      <td className="cell-kart">{driver?.kart || '-'}</td>
      <td className="cell-name" title={driver?.name || ''}>
        {driver?.name || ''}
      </td>
      <td className={isLeader ? 'cell-time cell-time-leader' : 'cell-time'}>{driver?.time || ''}</td>
    </>
  );
}

export function LiveTimingTable({ drivers }: { drivers: LiveTimingDriver[] }) {
  const mappedDrivers = driversByPosition(drivers);

  return (
    <table className="livetime-table" aria-label="Classificacao ao vivo">
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

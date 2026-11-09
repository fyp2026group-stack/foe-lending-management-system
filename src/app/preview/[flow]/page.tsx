import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Panel } from '../../../components/panel';

const flows = {
  requests: { title: 'Request detail', context: 'Example request · revision 1', note: 'Requested quantities are examples, with no stock commitment.', columns: ['Item', 'Kind', 'Requested', 'Stage'], rows: [['Demonstration microscope', 'Returnable', '1', 'Preview'], ['Example slides', 'Consumable', '5', 'Preview']] },
  approvals: { title: 'Approval queue', context: 'Example Lab A', note: 'Academic decisions and physical collection are separate. Decisions are unavailable.', columns: ['Request', 'Revision', 'Laboratory', 'Stage'], rows: [['Example request A', '1', 'Example Lab A', 'Preview']] },
  collection: { title: 'Collection review', context: 'Example collection · no physical action', note: 'A reservation and current authorization would be required in a future workflow. This preview creates neither.', columns: ['Item', 'Mode', 'Quantity', 'Status'], rows: [['Demonstration microscope', 'Identified equipment', '1', 'Preview only']] },
  returns: { title: 'Return and inspection', context: 'Example equipment record', note: 'Receipt into inspection is distinct from inspection clearance. No receipt or custody change is available.', columns: ['Equipment', 'Example custody', 'Inspection', 'Status'], rows: [['Demonstration microscope', 'Borrowed', 'Not received', 'Preview only']] },
} as const;

export function generateStaticParams() { return Object.keys(flows).map(flow => ({ flow })); }
export const dynamicParams = false;

export default async function PreviewPage({ params }: { params: Promise<{ flow: string }> }) {
  const { flow } = await params;
  if (!(flow in flows)) notFound();
  const preview = flows[flow as keyof typeof flows];
  return <main id="main" tabIndex={-1}>
    <Link className="text-link" href="/">Back to workspace</Link>
    <p className="eyebrow">Synthetic layout preview</p><h1>{preview.title}</h1><p>{preview.context}</p>
    <div className="notice">{preview.note}</div>
    <Panel title="Example records">
      <div className="table-region" role="region" aria-label={`${preview.title} example records`} tabIndex={0}>
        <table><caption>Invented examples; all workflow actions unavailable</caption>
          <thead><tr>{preview.columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
          <tbody>{preview.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </Panel>
  </main>;
}

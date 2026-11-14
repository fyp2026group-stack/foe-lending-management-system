import Link from 'next/link';
import { WorkspaceShell, StateExample } from '@/components/workspace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
export default function DesignSystemPage() {
  return (
    <WorkspaceShell>
      <p className="eyebrow">Synthetic demonstration / Interface reference</p>
      <h1>Design system</h1>
      <p className="intro">
        Compact administrative layouts. All examples are synthetic; workflow actions are
        unavailable.
      </p>
      <section className="reference-section">
        <h2>Type, colour and spacing</h2>
        <p>Arial system stack / 14px records / 16px section headings / 24px page titles.</p>
        <div className="swatches">
          <span>Surface #ffffff</span>
          <span>Canvas #f5f7fa</span>
          <span>Institutional blue #234f86</span>
        </div>
        <p>
          Ink #182334; secondary text #526175. Spacing 4 / 8 / 12 / 16 / 24 / 32px. Radius 4-6px;
          thin separators; minimal visual ornament.
        </p>
      </section>
      <section className="reference-section">
        <h2>Buttons, inputs and status</h2>
        <div className="example-row">
          <Button disabled>Unavailable operation</Button>
          <Button variant="outline" disabled>
            Secondary operation
          </Button>
          <Badge variant="outline">Awaiting review</Badge>
          <Badge variant="secondary">Inspection pending</Badge>
        </div>
        <label htmlFor="reference-example">Example reference (read only)</label>
        <Input id="reference-example" value="REQ-1041" readOnly />
        <p>
          Operational actions are disabled because M1 contains no workflow integration. Status
          always includes text.
        </p>
      </section>
      <section className="reference-section">
        <h2>Table, filter, pagination, dialog and drawer</h2>
        <p>
          Inventory demonstrates six invented records, local search and laboratory filters, four-row
          pagination and a reference-triggered read-only dialog. Mobile navigation opens a labelled
          modal drawer. The desktop sidebar remains visible.
        </p>
        <Link className="text-link" href="/">
          Open interactive component examples
        </Link>
      </section>
      <section className="reference-section">
        <h2>Interface states</h2>
        <div className="state-grid">
          {['Loading', 'Empty', 'Error', 'Success', 'Denied', 'Offline', 'Conflict', 'Unknown'].map(
            (state) => (
              <StateExample state={state} key={state} />
            )
          )}
        </div>
      </section>
      <section className="reference-section">
        <h2>Verification boundary</h2>
        <p>
          Rendered accessibility verification is pending: 360/768/1280px, 200% zoom, 400% reflow,
          keyboard and screen reader, table scrolling, dialog focus restoration, contrast and
          targets. No conformance claim.
        </p>
      </section>
    </WorkspaceShell>
  );
}

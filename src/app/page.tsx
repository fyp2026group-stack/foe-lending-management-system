import { Panel } from '../components/panel';
import Link from 'next/link';

const previews = [
  { title: 'Requests', path: 'requests', detail: 'Review requested items and per-line progress.' },
  { title: 'Approval queue', path: 'approvals', detail: 'Review revision details and decision context.' },
  { title: 'Collection', path: 'collection', detail: 'Review equipment identity and collection details.' },
  { title: 'Returns and inspection', path: 'returns', detail: 'Keep receipt and inspection progress distinct.' },
] as const;

export default function HomePage() {
  return <div className="workspace">
    <aside className="sidebar" aria-label="Workspace identity"><strong>LAB / WORKSPACE</strong><p>Laboratory inventory</p><span className="badge">M1 foundation</span></aside>
    <div className="content">
      <header className="topbar"><span>Synthetic demonstration</span><span>No account connected</span></header>
      <main id="main" tabIndex={-1}>
        <p className="eyebrow">Workspace overview</p><h1>Laboratory workspace</h1>
        <p className="intro">A clear view of requests, collection and equipment care.</p>
        <div className="notice" role="note">Interface preview using invented content. Workflow actions are unavailable in this foundation.</div>
        <div className="grid">{previews.map(preview => <Panel key={preview.title} title={preview.title}><p>{preview.detail}</p><Link className="text-link" href={`/preview/${preview.path}`}>Open layout preview</Link></Panel>)}</div>
        <Panel title="Demonstration laboratory"><dl><div><dt>Laboratory</dt><dd>Example Lab A</dd></div><div><dt>Content</dt><dd>Synthetic examples only</dd></div><div><dt>Stage</dt><dd>Foundation development</dd></div></dl></Panel>
      </main>
    </div>
  </div>;
}

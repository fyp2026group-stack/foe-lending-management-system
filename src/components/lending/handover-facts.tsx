import type { HandoverFact } from './api';
/** The protected loan reader supplies these immutable facts under current visibility. */
export function HandoverFacts({ handover }: { handover?: HandoverFact | null }) {
  return (
    <details>
      <summary>Recorded handover</summary>
      {handover ? (
        <>
          <p>Handed over {new Date(handover.created_at).toLocaleString('en-GB')}</p>
          <p className="whitespace-pre-wrap">
            {handover.remarks ?? 'No factual remarks recorded.'}
          </p>
          <details>
            <summary>Immutable record references</summary>
            <dl className="review-facts">
              <div>
                <dt>Loan</dt>
                <dd className="break-all">{handover.loan_id}</dd>
              </div>
              <div>
                <dt>Movement</dt>
                <dd className="break-all">{handover.movement_id}</dd>
              </div>
              <div>
                <dt>Recorded officer reference</dt>
                <dd className="break-all">{handover.actor_id}</dd>
              </div>
            </dl>
          </details>
        </>
      ) : (
        <p>No immutable handover facts were recorded for this legacy issue.</p>
      )}
    </details>
  );
}

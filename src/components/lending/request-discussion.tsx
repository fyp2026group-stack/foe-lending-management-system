'use client';
import { StudentEmptyState } from './student-empty-state';
import { isStudent } from './student-model';
import { useState, useRef } from 'react';
import type { Session } from '@/components/identity/api';
import { ErrorNotice } from '@/components/identity/session';
import { Button } from '@/components/ui/button';
import { ActionForm, useLending } from './shared';
import type { BorrowRequest, LendingComment, Page } from './api';

export function RequestDiscussion({
  requestId,
  session,
  revision,
  compact = false,
}: {
  requestId: string;
  session: Session;
  revision: number;
  compact?: boolean;
}) {
  const student = isStudent(session.user.roles);
  const discussion = useRef<HTMLElement>(null);
  const [localRevision, setLocalRevision] = useState(0);
  const [correcting, setCorrecting] = useState<LendingComment | null>(null);
  const [notice, setNotice] = useState('');
  const comments = useLending<Page<LendingComment>>(
    'comments?requestId=' + encodeURIComponent(requestId),
    revision + localRevision
  );
  const request = useLending<Page<BorrowRequest>>(
    'requests?requestId=' + encodeURIComponent(requestId),
    revision + localRevision
  );
  const correctedIds = new Set(
    comments.data?.items.flatMap((comment) => (comment.correctsId ? [comment.correctsId] : []))
  );
  const currentCorrection =
    correcting &&
    comments.data?.items.find(
      (comment) =>
        comment.id === correcting.id &&
        comment.authorId === session.user.id &&
        !correctedIds.has(comment.id)
    );
  function saved() {
    setCorrecting(null);
    setNotice('Comment appended to the request history.');
    setLocalRevision((value) => value + 1);
  }
  return (
    <section ref={discussion} className={compact ? "request-discussion-compact" : "records p-4 mt-4"}>
      {!compact && <h2>Decision history and request discussion</h2>}
      {!compact && <>
      {request.error && <ErrorNotice message={request.error} />}
      {!request.data && !request.error && <p role="status">Loading decision history...</p>}
      {request.data?.items.map((record) => (
        <div key={record.id}>
          {record.lines.map((line) => (
            <section className="border-b py-3" key={line.id}>
              <h3 className="font-semibold">
                {line.item} / {line.stage}
              </h3>
              {line.decisions.length ? (
                line.decisions.map((decision) => (
                  <article key={decision.id} className="py-2">
                    <p>
                      {decision.actor} / {decision.stage} / {decision.decision} /{' '}
                      <time dateTime={decision.createdAt}>
                        {new Date(decision.createdAt).toLocaleString()}
                      </time>
                    </p>
                    <p className="whitespace-pre-wrap break-words">{decision.remarks}</p>
                  </article>
                ))
              ) : student ? (
                <StudentEmptyState kind="decisions" />
              ) : (
                <p>No decisions recorded for this line.</p>
              )}
            </section>
          ))}
        </div>
      ))}
      {request.data?.items.length === 0 && (
        <>
          {student ? (
            <StudentEmptyState kind="unavailable" />
          ) : (
            <p role="status">This request is unavailable in your current scope.</p>
          )}
        </>
      )}
      </>}
      <h3 className="font-semibold mt-4">{compact ? 'Comments' : 'Append-only comments'}</h3>
      {!compact && <p className="muted">Corrections add a linked entry and preserve the original comment.</p>}
      {notice && <p role="status">{notice}</p>}
      {comments.error && <ErrorNotice message={comments.error} />}
      {!comments.data && !comments.error && <p role="status">Loading comments...</p>}
      {!compact && comments.data?.items.length === 0 && (!student || Boolean(request.data?.items.length)) && (
        <>
          {student ? (
            <StudentEmptyState
              kind="comments"
              actionLabel="Add a comment"
              onAction={() =>
                discussion.current
                  ?.querySelector<HTMLTextAreaElement>('textarea[name="body"]')
                  ?.focus()
              }
            />
          ) : (
            <p>No comments recorded.</p>
          )}
        </>
      )}
      {comments.data?.items.map((comment) => (
        <article key={comment.id} className="border-b py-3">
          <p>
            {comment.author} /{' '}
            <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString()}</time>
          </p>
          {comment.correctsId && (
            <p className="muted">
              Correction to{' '}
              {comments.data?.items.find((prior) => prior.id === comment.correctsId)?.author ??
                'an earlier entry'}{' '}
              at{' '}
              {new Date(
                comments.data?.items.find((prior) => prior.id === comment.correctsId)?.createdAt ??
                  comment.createdAt
              ).toLocaleString()}
            </p>
          )}
          <p className="whitespace-pre-wrap break-words">{comment.body}</p>
          {correctedIds.has(comment.id) ? (
            <p className="muted">A linked correction appears later in this history.</p>
          ) : (
            comment.authorId === session.user.id && (
              <Button type="button" variant="outline" onClick={() => setCorrecting(comment)}>
                Correct this comment
              </Button>
            )
          )}
        </article>
      ))}
      {comments.data && request.data?.items.length ? (
        compact ? <details className="request-comment-composer">
          <summary>Write a comment</summary>
          <ActionForm
          key={currentCorrection?.id ?? 'new-comment'}
          compact={compact}
          title={currentCorrection ? 'Correct comment' : 'Post comment'}
          path="comments"
          session={session}
          onSaved={saved}
          body={(data) => {
            const body = String(data.get('body')).trim();
            if (!body) throw new Error('Enter a comment before submitting.');
            return {
              requestId,
              body,
              ...(currentCorrection ? { correctsId: currentCorrection.id } : {}),
            };
          }}
        >
          {currentCorrection && (
            <p>
              Correcting your entry from {new Date(currentCorrection.createdAt).toLocaleString()}.
              The original will remain visible.
            </p>
          )}
          <label htmlFor="request-comment-body">
            {currentCorrection ? 'Corrected comment' : 'Comment'}
            <textarea
              id="request-comment-body"
              name="body"
              className="border rounded-md w-full p-3 min-h-24"
              required
              maxLength={1000}
              defaultValue={currentCorrection?.body ?? ''}
            />
          </label>
          {currentCorrection && (
            <Button type="button" variant="outline" onClick={() => setCorrecting(null)}>
              Cancel correction
            </Button>
          )}
          </ActionForm>
        </details> : <ActionForm
          key={currentCorrection?.id ?? 'new-comment'}
          title={currentCorrection ? 'Append comment correction' : 'Add request comment'}
          path="comments"
          session={session}
          onSaved={saved}
          body={(data) => {
            const body = String(data.get('body')).trim();
            if (!body) throw new Error('Enter a comment before submitting.');
            return { requestId, body, ...(currentCorrection ? { correctsId: currentCorrection.id } : {}) };
          }}
        >
          <label htmlFor="request-comment-body-standard">Comment
            <textarea id="request-comment-body-standard" name="body"
              className="border rounded-md w-full p-3 min-h-24" required maxLength={1000}
              defaultValue={currentCorrection?.body ?? ''} />
          </label>
          {currentCorrection && <Button type="button" variant="outline" onClick={() => setCorrecting(null)}>Cancel correction</Button>}
        </ActionForm>
      ) : null}
    </section>
  );
}

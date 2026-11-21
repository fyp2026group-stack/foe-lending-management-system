'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@/components/identity/api';
import { PageHeader } from '@/components/ui/page-header';
import { EquipmentBrowser, type BrowserSource } from './equipment-browser';
import { editEquipmentSelection } from './equipment-selection';
import { basketKey, readSelection, persistStudentSelection } from './student-model';
import type { DraftPayload } from './api';
import { quantityLimit } from './request-options';
export function StudentBrowse({ session, audience = 'Laboratory catalogue' }: { session: Session; audience?: string }) {
  const router = useRouter();
  const [basket, setBasket] = useState<DraftPayload['lines']>(() => { try { return readSelection(sessionStorage.getItem(basketKey(session.user.id))); } catch { return []; } });
  const [notice, setNotice] = useState('');
  function update(source: BrowserSource, quantity: number) {
    const next = editEquipmentSelection(basket, { itemId: source.itemId, labId: source.labId, locationId: source.locationId, quantity }, row => row.itemId, Math.min(source.availableQuantity, quantityLimit(source)));
    setBasket(next);
    try { persistStudentSelection(sessionStorage, session.user.id, next); setNotice(''); } catch { setNotice('Browser storage is unavailable. Keep this page open and enable storage to continue.'); }
  }
  function start() {
    try { persistStudentSelection(sessionStorage, session.user.id, basket); router.push('/borrowing?view=new'); }
    catch { setNotice('Browser storage is unavailable. Enable storage to continue with this selection.'); }
  }
  return <div className="student-page approved-equipment-page"><PageHeader eyebrow={audience} title="Browse equipment" description="Find what you need, review availability and build a borrowing request."/>
    {notice && <p role="status">{notice}</p>}<EquipmentBrowser selected={basket} onQuantity={update} onContinue={start}/></div>;
}

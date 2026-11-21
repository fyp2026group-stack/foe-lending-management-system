'use client';
import { Authenticated } from '@/components/identity/session';
import { StudentBrowse } from '@/components/lending/student-browse';
export default function EquipmentPage() {
  return <Authenticated>{session => <StudentBrowse session={session}/>}</Authenticated>;
}

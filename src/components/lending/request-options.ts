import type { Lecturer, LendingSource } from './api';

export function quantityLimit(source: LendingSource) {
  return Math.min(1000, source.kind === 'RETURNABLE' ? 20 : 1000);
}

export function eligibleLecturers(lecturers: Lecturer[], labIds: string[], borrowerId?: string) {
  return lecturers.filter(
    (lecturer) =>
      lecturer.id !== borrowerId && labIds.every((labId) => lecturer.labIds.includes(labId))
  );
}

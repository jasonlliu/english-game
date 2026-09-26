import type { PetId } from './adventure';

export function canPetFly(id: PetId | null | undefined, stage: number): boolean {
  return id === 'lumi' || (id === 'ember' && stage === 3);
}

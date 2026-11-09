/** Shared, invented equipment custody. No consumables or policy rules. */
export const syntheticLoans = [
 { loanId:'LOAN-1041', assetId:'AST-210', item:'Compound microscope', lab:'Biology A', issued:1, received:0, inspection:'Not received' },
 { loanId:'LOAN-1042', assetId:'AST-211', item:'Digital analytical balance', lab:'Chemistry B', issued:1, received:1, inspection:'Inspection pending' },
 { loanId:'LOAN-1043', assetId:'AST-212', item:'Temperature probe', lab:'Physics C', issued:1, received:1, inspection:'Damaged after receipt - review pending' },
 { loanId:'LOAN-1044', assetId:'AST-213', item:'Temperature probe', lab:'Physics C', issued:1, received:0, inspection:'Not received' },
 { loanId:'LOAN-1045', assetId:'AST-214', item:'Bench centrifuge', lab:'Biology A', issued:1, received:1, inspection:'Post-receipt maintenance' },
 { loanId:'LOAN-1046', assetId:'AST-215', item:'Optical spectrometer', lab:'Physics C', issued:1, received:1, inspection:'Inspection cleared' },
] as const;
export function syntheticLoanRows(view:'borrowing'|'returns'):string[][] {
 return syntheticLoans.map(loan=>{
  const outstanding=loan.issued-loan.received;
  const custody=`${loan.received} received / ${outstanding} outstanding`;
  return [loan.loanId,`${loan.item} / ${loan.assetId}`,loan.lab,view==='borrowing'?`${custody}; original due 18 Nov 2026`:custody,outstanding>0?'Outstanding - not received':`Received / ${loan.inspection}`];
 });
}

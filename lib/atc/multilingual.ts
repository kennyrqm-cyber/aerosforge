export const coachingLanguages=['en','es','fr','pt','de'] as const;
export type CoachingLanguage=typeof coachingLanguages[number];
const labels:Record<CoachingLanguage,{good:string;retry:string}>={
 en:{good:'Readback accepted.',retry:'Correct the highlighted readback items and transmit again.'},
 es:{good:'Lectura de retorno aceptada.',retry:'Corrige los elementos resaltados y transmite de nuevo.'},
 fr:{good:'Relecture acceptée.',retry:'Corrigez les éléments signalés et transmettez de nouveau.'},
 pt:{good:'Readback aceito.',retry:'Corrija os itens destacados e transmita novamente.'},
 de:{good:'Rücklesung akzeptiert.',retry:'Korrigiere die markierten Punkte und sende erneut.'}
};
export function coach(lang:CoachingLanguage,passed:boolean){return labels[lang][passed?'good':'retry'];}

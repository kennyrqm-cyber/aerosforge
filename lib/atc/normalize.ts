const digitWords:Record<string,string>={zero:'0',oh:'0',one:'1',two:'2',three:'3',four:'4',five:'5',fife:'5',six:'6',seven:'7',eight:'8',niner:'9',nine:'9'};
const phonetic:Record<string,string>={alpha:'A',bravo:'B',charlie:'C',delta:'D',echo:'E',foxtrot:'F',golf:'G',hotel:'H',india:'I',juliett:'J',juliet:'J',kilo:'K',lima:'L',mike:'M',november:'N',oscar:'O',papa:'P',quebec:'Q',romeo:'R',sierra:'S',tango:'T',uniform:'U',victor:'V',whiskey:'W',xray:'X','x-ray':'X',yankee:'Y',zulu:'Z'};

function normalizeAltitudePhrases(input:string){
  // Supports common ATC forms such as "three thousand" and "three thousand five hundred".
  return input
    .replace(/\b([0-9])\s+thousand\s+([0-9])\s+hundred\b/g,(_,thousands,hundreds)=>`${thousands}${hundreds}00`)
    .replace(/\b([0-9])\s+thousand\b/g,(_,thousands)=>`${thousands}000`)
    .replace(/\b([0-9])\s+hundred\b/g,(_,hundreds)=>`${hundreds}00`);
}

export function normalizeSpeech(input:string){
  let s=input.toLowerCase().replace(/[^a-z0-9. -]/g,' ').replace(/\s+/g,' ').trim();
  for(const [word,d] of Object.entries(digitWords)) s=s.replace(new RegExp(`\\b${word}\\b`,'g'),d);
  for(const [word,l] of Object.entries(phonetic)) s=s.replace(new RegExp(`\\b${word}\\b`,'g'),l);
  s=normalizeAltitudePhrases(s);
  s=s.replace(/\bpoint\b/g,'.').replace(/\s*\.\s*/g,'.');
  return s;
}
export function compact(input:string){return normalizeSpeech(input).replace(/\s+/g,'').toUpperCase();}

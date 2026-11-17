export const DEFAULT_MOUTH_EXPRESSION=2.1;
// Shape only the visible articulation; the audio and rhythm envelopes remain
// unchanged. Quiet syllables stay small while accents have room to open wider.
export function mouthArticulation(level){
 const x=Math.max(0,Math.min(1,((Number(level)||0)-.025)/.935));
 return x*x*(3-2*x);
}

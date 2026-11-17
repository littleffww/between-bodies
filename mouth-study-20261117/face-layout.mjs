export const MAX_PARTICIPANTS=6;
export const FACE_ANGLES=[.46,-.56,1.49,-1.60,2.54,-2.64];
export const FACE_TILE=384;
export function makeFaceAtlas(){const data=new Uint8Array(FACE_TILE*3*FACE_TILE*2*4);for(let i=0;i<data.length;i+=4){data[i]=128;data[i+3]=255}return data}
export function writeFaceTile(data,slot,relief){
 if(slot<0||slot>=MAX_PARTICIPANTS||relief?.size!==FACE_TILE)throw Error('Invalid face tile');
 const x=(slot%3)*FACE_TILE,y=Math.floor(slot/3)*FACE_TILE;
 for(let row=0;row<FACE_TILE;row++)data.set(relief.data.subarray(row*FACE_TILE*4,(row+1)*FACE_TILE*4),((y+row)*FACE_TILE*3+x)*4);
}
export function clearFaceTile(data,slot){
 const x=(slot%3)*FACE_TILE,y=Math.floor(slot/3)*FACE_TILE;
 for(let row=0;row<FACE_TILE;row++)for(let col=0;col<FACE_TILE;col++){const i=((y+row)*FACE_TILE*3+x+col)*4;data[i]=128;data[i+1]=data[i+2]=0;data[i+3]=255}
}

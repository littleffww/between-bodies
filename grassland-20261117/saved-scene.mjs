// Restore the saved look without automatically starting audio playback.
const saved = {"audioName": "RCA_V4_ORIGINAL_VOICES_CUTUP_SONG.mp3", "fields": [{"checked": false, "id": "mouth-model", "value": "wholeMouth"}, {"checked": false, "id": "lip-thickness", "value": "138"}, {"checked": false, "id": "lip-upper", "value": "#9e534f"}, {"checked": false, "id": "lip-lower", "value": "#ae6563"}, {"checked": false, "id": "skin-detail", "value": "100"}, {"checked": false, "id": "skin-relief", "value": "165"}, {"checked": false, "id": "grass-length", "value": "100"}, {"checked": false, "id": "grass-angle", "value": "0"}, {"checked": false, "id": "grass-lean", "value": "68"}, {"checked": false, "id": "wind-strength", "value": "175"}, {"checked": false, "id": "wind-angle", "value": "30"}, {"checked": false, "id": "tuft-density", "value": "70"}, {"checked": false, "id": "ground-detail", "value": "100"}, {"checked": false, "id": "ground-relief", "value": "100"}, {"checked": false, "id": "day-hour", "value": "7.21"}, {"checked": false, "id": "day-animate", "value": "on"}, {"checked": false, "id": "cloud-choice", "value": "4"}, {"checked": false, "id": "cloud-speed", "value": "9"}, {"checked": false, "id": "cloud-angle", "value": "59"}, {"checked": false, "id": "cloud-size", "value": "95"}, {"checked": false, "id": "cloud-density", "value": "100"}, {"checked": false, "id": "crawl-mode", "value": "sway"}, {"checked": false, "id": "crawl-direction", "value": "natural"}, {"checked": false, "id": "crawler-entry", "value": "hill"}, {"checked": true, "id": "crawler-collision", "value": "on"}, {"checked": false, "id": "recording-gain", "value": "30"}]};
export function restoreSavedScene(){
 for(const field of saved.fields){
  const input=document.getElementById(field.id);
  if(!input)continue;
  if(input.type==='checkbox')input.checked=Boolean(field.checked);
  else input.value=field.value;
  input.dispatchEvent(new Event(input.tagName==='SELECT'||input.type==='checkbox'?'change':'input',{bubbles:true}));
 }
 const audio=document.getElementById('recording');
 if(audio){audio.src=new URL('./audio/RCA_V4_ORIGINAL_VOICES_CUTUP_SONG.mp3',import.meta.url).href;audio.load();}
 const status=document.getElementById('recording-status');
 if(status)status.textContent='RCA_V4_ORIGINAL_VOICES_CUTUP_SONG.mp3';
}

// Conversion stays on the loopback preview server; no media is sent to a cloud service.
export async function isPremiereExportAvailable(){
 try{const response=await fetch('/api/export-premiere',{cache:'no-store'});if(!response.ok)return false;return !!(await response.json()).available}catch{return false}
}
export async function finalizePremiere(blob,{signal}={}){
 if(!blob?.size)throw Error('没有可转换的视频。');
 if(blob.size>1024*1024*1024)throw Error('视频超过 1 GB，请缩短录制后重试。');
 const response=await fetch('/api/export-premiere',{method:'POST',headers:{'Content-Type':'video/webm'},body:blob,signal});
 if(!response.ok){let message;try{message=(await response.json()).error}catch{}throw Error(message||'本地 MOV 转换服务不可用，请重启项目预览后重试。')}
 const output=await response.blob();if(!output.size)throw Error('转换未生成视频，请重试。');
 return output.type==='video/quicktime'?output:new Blob([output],{type:'video/quicktime'});
}

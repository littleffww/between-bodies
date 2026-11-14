import {mouthRows} from './mouth-language.mjs?v=lip-tint';
import {captureRows} from './capture-language.mjs?v=relief-v11';
import {exportRows} from './export-language.mjs?v=alpha-v18';
import {chorusRows} from './chorus-language.mjs?v=feature-fit-v16';
import {reliefRows} from './relief-language.mjs?v=relief-v11';
import {fusionRows} from './fusion-language.mjs?v=relief-v11';
import {trackingRows} from './tracking-language.mjs';
const rows=[
['青紫程度','青紫程度','青紫の濃さ','Blue-violet intensity'],
['出汗程度','出汗程度','汗の量','Sweat amount'],
['‹ 半身','‹ 半身','‹ 半身','‹ Half-body'],
['一半是你','一半是你','半分は、あなた','Half of it is you'],
['夜览','夜覽','ナイトビュー','Night view'],['关于作品','關於作品','作品について','About'],['保存画面','儲存畫面','画像を保存','Save image'],['全屏','全螢幕','全画面','Fullscreen'],
['拍下我的一部分','拍下我的一部分','身体の一部を撮る','Capture part of me'],['再拍一部分','再拍一部分','もう一度撮る','Take another photo'],['选择照片','選擇照片','写真を選ぶ','Choose a photo'],
['开启声音','開啟聲音','音をオン','Enable sound'],['关闭声音','關閉聲音','音をオフ','Mute sound'],
['拍下身体的一部分。保留你的纹理，让另一半在触碰中生长。','拍下身體的一部分。保留你的紋理，讓另一半在觸碰中生長。','身体の一部を撮影。あなたの肌の質感を残し、もう半分は触れることで変わっていく。','Photograph part of your body. Keep your own texture; let the other half grow through touch.'],
['保留你的纹理。触碰、改变，或让它自己呼吸。','保留你的紋理。觸碰、改變，或讓它自己呼吸。','あなたの質感を残す。触れて変える、あるいは呼吸を見守る。','Keep your own texture. Touch, reshape, or let it breathe.'],
['拖动旋转，轻触施压。选择下方动作，让两种身体一起变化。','拖動旋轉，輕觸施壓。選擇下方動作，讓兩種身體一起變化。','ドラッグで回転、タップで押す。下の動きで二つの身体を一緒に変える。','Drag to rotate, tap to press. Choose a movement below to reshape both halves.'],
['蠕动','蠕動','うごめき','Motion'],['湿润','濕潤','潤い','Moisture'],['体积','體積','大きさ','Size'],
['呼吸','呼吸','呼吸','Breathe'],['蜷缩','蜷縮','縮む','Curl'],['拉长','拉長','伸びる','Stretch'],['颤动','顫動','震える','Shiver'],['轻压','輕壓','押す','Press'],
['暂停蠕动','暫停蠕動','動きを止める','Pause motion'],['继续蠕动','繼續蠕動','動きを再開','Resume motion'],['恢复原状','恢復原狀','元に戻す','Reset'],
['照片只在当前页面处理，不会上传。','照片只在目前頁面處理，不會上傳。','写真はこのページ内で処理され、送信されません。','Photos stay in this page and are never uploaded.'],['清除后，就会消失。','清除後，就會消失。','消去すると残りません。','Clear them whenever you wish.'],
['AI 材质预览 · 拍照后加入你的身体','AI 材質預覽 · 拍照後加入你的身體','AI 素材プレビュー · 撮影するとあなたの身体が加わります','AI texture preview · Add your own body with a photo'],
['左侧 · 你的身体　／　右侧 · AI 生成皮肤','左側 · 你的身體　／　右側 · AI 生成皮膚','左 · あなたの身体 ／ 右 · AI 生成の肌','Left · Your body / Right · AI-generated skin'],
['你的身体 × AI 皮肤','你的身體 × AI 皮膚','あなたの身体 × AI の肌','Your body × AI skin'],['各保留一半','各保留一半','それぞれ半分ずつ','Half of each'],['调整照片','調整照片','写真を調整','Adjust photo'],['清除照片','清除照片','写真を消去','Clear photo'],
['靠近一点。','靠近一點。','もう少し近くに。','A little closer.'],['让手掌、前臂或脸颊填满取景框。','讓手掌、前臂或臉頰填滿取景框。','手のひら、腕、頬などで枠を満たしてください。','Fill the frame with your palm, forearm, or cheek.'],
['正在开启摄像头…','正在開啟攝影機…','カメラを起動中…','Opening camera…'],['切换镜头','切換鏡頭','カメラを切替','Switch camera'],['拍摄','拍攝','撮影','Capture'],
['保留哪一部分？','保留哪一部分？','どの部分を残す？','Which part will you keep?'],['拖动照片选择范围，它会成为肉体的左半侧。','拖動照片選擇範圍，它會成為肉體的左半側。','ドラッグして範囲を選ぶと、身体の左半分になります。','Drag to choose the area that will become the left half.'],['靠近','靠近','拡大','Zoom'],['与另一半相遇','與另一半相遇','もう半分と出会う','Meet the other half'],
['半身','半身','半身','Between Bodies'],
['你留下皮肤上的纹理，系统给它一个陌生的形体。两者共享一次呼吸，也在每一次触碰里改变彼此。','你留下皮膚上的紋理，系統給它一個陌生的形體。兩者共享一次呼吸，也在每一次觸碰裡改變彼此。','あなたが残した肌の質感に、システムが見知らぬ形を与える。二つは呼吸を分かち合い、触れるたびに互いを変えていく。','You leave the texture of your skin. The system gives it an unfamiliar body. Both share a breath and change one another with each touch.'],
['一半来自你拍下的身体，一半使用预先由 AI 生成的皮肤材质。形体和蠕动由程序实时计算。照片保留在你的浏览器内，本版不会将每位观众的照片上传给 AI 再生成。','一半來自你拍下的身體，一半使用預先由 AI 生成的皮膚材質。形體和蠕動由程式即時計算。照片保留在你的瀏覽器內，本版不會將每位觀眾的照片上傳給 AI 再生成。','半分は撮影した身体、もう半分は事前に AI で生成した肌の素材です。形とうごめきはプログラムがリアルタイムで計算します。写真はブラウザー内に留まり、この版では AI への送信や参加者ごとの再生成は行いません。','One half uses your photograph; the other uses a skin texture generated with AI beforehand. Shape and motion are calculated in real time. Photos stay in your browser. This version does not send each visitor’s photo to an AI service for regeneration.'],
['呼吸和颤动有不同的声音。拉长、收缩和轻压，也会改变它的声响。你可以随时暂停、清除照片，或重新开始。','呼吸和顫動有不同的聲音。拉長、收縮和輕壓，也會改變它的聲響。你可以隨時暫停、清除照片，或重新開始。','呼吸と震えには異なる音があります。伸縮や押す動きも音を変えます。いつでも停止、写真の消去、やり直しができます。','Breathing and shivering sound different. Stretching, curling, and pressing also change the sound. Pause, clear your photo, or begin again at any time.'],
['建议使用手掌、手臂、脸颊等身体局部。拍摄前先获得参与者同意。','建議使用手掌、手臂、臉頰等身體局部。拍攝前先獲得參與者同意。','手のひら、腕、頬などを使用してください。撮影前に参加者の同意を得てください。','Use a palm, arm, cheek, or another body detail. Ask for the participant’s consent before taking their photo.'],
['轻触它，看它回应。','輕觸它，看它回應。','触れて、反応を見る。','Touch it and watch it respond.'],['正在准备身体…','正在準備身體…','身体を準備中…','Preparing the body…'],
['你的纹理，正在长入另一种身体。','你的紋理，正在長入另一種身體。','あなたの質感が、別の身体に育っていく。','Your texture is growing into another body.'],['照片已清除。','照片已清除。','写真を消去しました。','Photo cleared.'],['一次触碰，沿着表面传开。','一次觸碰，沿著表面傳開。','ひとつの触れ合いが、表面を伝わる。','One touch travels across the surface.'],['慢慢回到最初的呼吸。','慢慢回到最初的呼吸。','最初の呼吸へ、ゆっくり戻る。','Returning to the first breath.'],
['画面已保存。','畫面已儲存。','画像を保存しました。','Image saved.'],['画面保存失败，请重试。','畫面儲存失敗，請重試。','保存できませんでした。もう一度お試しください。','Could not save the image. Please try again.'],
['摄像头未获允许。关闭此窗口后可以选择照片。','攝影機未獲允許。關閉此視窗後可以選擇照片。','カメラが許可されていません。閉じて写真を選ぶこともできます。','Camera permission was denied. Close this window to choose a photo instead.'],['摄像头暂不可用。请检查镜头，或选择一张照片。','攝影機暫不可用。請檢查鏡頭，或選擇一張照片。','カメラを使用できません。確認するか、写真を選んでください。','Camera unavailable. Check your camera or choose a photo.'],
['此处无法使用摄像头。可以选择一张照片。','此處無法使用攝影機。可以選擇一張照片。','ここではカメラを使えません。写真を選んでください。','Camera unavailable here. You can choose a photo instead.'],
['照片太大，请选择小于 30 MB 的图片。','照片太大，請選擇小於 30 MB 的圖片。','30 MB 未満の画像を選んでください。','Choose an image smaller than 30 MB.'],['这张照片暂时无法读取。请换成 JPG、PNG 或 WebP。','這張照片暫時無法讀取。請換成 JPG、PNG 或 WebP。','読み込めません。JPG、PNG、WebP をお試しください。','Could not read this photo. Try JPG, PNG, or WebP.'],
['镜头已关闭。关闭后重新拍摄即可继续。','鏡頭已關閉。關閉後重新拍攝即可繼續。','カメラを停止しました。閉じて撮影し直してください。','Camera stopped. Close this window and capture again.'],
['声音已开启。继续蠕动时，一起呼吸。','聲音已開啟。繼續蠕動時，一起呼吸。','音をオンにしました。動きを再開すると一緒に呼吸します。','Sound enabled. Resume motion to hear it breathe.'],['声音未能开启，请再试一次。','聲音未能開啟，請再試一次。','音を開始できませんでした。もう一度お試しください。','Could not start sound. Please try again.'],['这个浏览器暂不支持全屏。','這個瀏覽器暫不支援全螢幕。','このブラウザーは全画面表示に対応していません。','Fullscreen is unavailable in this browser.'],
['可触碰的肉体雕塑','可觸碰的肉體雕塑','触れられる身体の彫刻','Touchable body sculpture'],['身体状态控制','身體狀態控制','身体の状態','Body controls'],['身体动作','身體動作','身体の動き','Body movements'],['已使用的身体照片','已使用的身體照片','使用中の身体の写真','Your body photograph'],['关闭相机','關閉相機','カメラを閉じる','Close camera'],['取消使用照片','取消使用照片','写真をキャンセル','Cancel photo'],['关闭作品介绍','關閉作品介紹','作品紹介を閉じる','Close about'],['拖动或使用方向键调整照片裁切','拖動或使用方向鍵調整照片裁切','ドラッグまたは矢印キーで範囲を調整','Drag or use arrow keys to crop'],['拖动旋转肉体，轻触施压','拖動旋轉肉體，輕觸施壓','ドラッグで回転、タップで押す','Drag to rotate, tap to press'],
['浏览器暂时无法显示 3D。请尝试使用 Safari 或 Chrome。','瀏覽器暫時無法顯示 3D。請嘗試使用 Safari 或 Chrome。','3D を表示できません。Safari または Chrome をお試しください。','3D is unavailable. Please try Safari or Chrome.'],['皮肤材质未能载入，请刷新重试。','皮膚材質未能載入，請重新整理。','肌の素材を読み込めません。再読み込みしてください。','Could not load the skin texture. Please refresh.']
];
rows.push(...trackingRows,...fusionRows,...captureRows,...reliefRows,...chorusRows,...exportRows,...mouthRows);
const lookup=new Map();for(const row of rows)for(const text of row)lookup.set(text,row);
let language='zh',switchID=0;
function translate(value){const trimmed=value.trim(),row=lookup.get(trimmed);return row?value.replace(trimmed,row[['zh','zh-Hant','ja','en'].indexOf(language)]):value}
function update(root){
 if(root.nodeType===Node.TEXT_NODE){const v=translate(root.textContent);if(v!==root.textContent)root.textContent=v;return}
 if(root.nodeType!==Node.ELEMENT_NODE||root.closest('script,style,.languages,svg'))return;
 for(const key of ['aria-label','title','alt']){if(root.hasAttribute(key)){const v=translate(root.getAttribute(key));if(v!==root.getAttribute(key))root.setAttribute(key,v)}}
 for(const child of [...root.childNodes])update(child);
}
const observer=new MutationObserver(records=>{for(const r of records){if(r.type==='characterData')update(r.target);else for(const n of r.addedNodes)update(n)}});
observer.observe(document.body,{subtree:true,childList:true,characterData:true});
document.querySelectorAll('[data-lang]').forEach(button=>button.onclick=async()=>{
 const id=++switchID,reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const areas=[...document.querySelectorAll('.intro,.panel,.shape-dock,.scene-label')];
 if(!reduce)await Promise.all(areas.map(e=>e.animate([{opacity:1},{opacity:0}],{duration:110,fill:'forwards'}).finished.catch(()=>{})));
 if(id!==switchID)return;
 language=button.dataset.lang;document.documentElement.lang=language==='zh'?'zh-CN':language;
 update(document.body);document.querySelectorAll('[data-lang]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 for(const e of areas){e.getAnimations().forEach(a=>a.cancel());if(!reduce)e.animate([{opacity:0},{opacity:1}],{duration:190})}
});

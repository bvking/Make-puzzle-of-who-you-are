// Archives autonomes et privées : aucune requête réseau, aucune dépendance.
const NAMES=['scan.json','visage-A.jpg','visage-B.jpg'];
const LIMIT=12*1024*1024;
const utf8=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const crcTable=Uint32Array.from({length:256},(_,n)=>{
 let c=n;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;
});
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
function check(condition,message){if(!condition)throw new Error(message)}
function landmarksValid(points){
 return Array.isArray(points)&&points.length>=468&&points.length<=478&&points.every(p=>
  p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-1&&p.x<=2&&p.y>=-1&&p.y<=2&&
  (p.z===undefined||Number.isFinite(p.z)));
}
function ringValid(points){
 return points==null||(Array.isArray(points)&&points.length>=24&&points.length<=128&&
  points.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)));
}
function bytesJoin(parts){const length=parts.reduce((s,p)=>s+p.length,0),out=new Uint8Array(length);let pos=0;for(const p of parts){out.set(p,pos);pos+=p.length}return out}
function zipStore(entries){
 const locals=[],central=[];let offset=0;
 for(const [name,data] of entries){
  const nameBytes=utf8.encode(name),size=data.length,crc=crc32(data);
  check(size<=LIMIT&&nameBytes.length<=255,'Fichier ZIP trop volumineux');
  const header=new Uint8Array(30+nameBytes.length),h=new DataView(header.buffer);
  h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);
  h.setUint32(14,crc,true);h.setUint32(18,size,true);h.setUint32(22,size,true);
  h.setUint16(26,nameBytes.length,true);header.set(nameBytes,30);
  locals.push(header,data);
  const directory=new Uint8Array(46+nameBytes.length),d=new DataView(directory.buffer);
  d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);
  d.setUint32(16,crc,true);d.setUint32(20,size,true);d.setUint32(24,size,true);
  d.setUint16(28,nameBytes.length,true);d.setUint32(42,offset,true);
  directory.set(nameBytes,46);central.push(directory);offset+=header.length+size;
 }
 const cbytes=bytesJoin(central),end=new Uint8Array(22),view=new DataView(end.buffer);
 view.setUint32(0,0x06054b50,true);view.setUint16(8,entries.length,true);
 view.setUint16(10,entries.length,true);view.setUint32(12,cbytes.length,true);
 view.setUint32(16,offset,true);
 return new Blob([...locals,cbytes,end],{type:'application/zip'});
}
function zipRead(bytes){
 check(bytes.length>=22&&bytes.length<=LIMIT,'Archive ZIP trop volumineuse ou vide');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let end=-1;
 for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)
  if(view.getUint32(p,true)===0x06054b50&&p+22+view.getUint16(p+20,true)===bytes.length){end=p;break}
 check(end>=0,'Structure ZIP invalide');
 const count=view.getUint16(end+10,true),directorySize=view.getUint32(end+12,true);
 let pos=view.getUint32(end+16,true);
 check(count===NAMES.length&&directorySize<=LIMIT&&pos+directorySize===end,'Contenu ZIP inattendu');
 const result=new Map();
 for(let i=0;i<count;i++){
  check(pos+46<=end&&view.getUint32(pos,true)===0x02014b50,'Répertoire ZIP endommagé');
  const flags=view.getUint16(pos+8,true),method=view.getUint16(pos+10,true),
   crc=view.getUint32(pos+16,true),size=view.getUint32(pos+20,true),
   compressed=view.getUint32(pos+24,true),nameSize=view.getUint16(pos+28,true),
   extra=view.getUint16(pos+30,true),comment=view.getUint16(pos+32,true),
   localPos=view.getUint32(pos+42,true);
  check(flags===0&&method===0&&size===compressed&&size<=LIMIT,'Compression ou format ZIP non pris en charge');
  check(pos+46+nameSize+extra+comment<=end,'Entrée ZIP tronquée');
  const name=decoder.decode(bytes.subarray(pos+46,pos+46+nameSize));
  check(NAMES.includes(name)&&!result.has(name),'Fichier non attendu ou en double dans le ZIP');
  check(localPos+30<=pos&&view.getUint32(localPos,true)===0x04034b50,'Données ZIP invalides');
  const localNameLength=view.getUint16(localPos+26,true),localExtra=view.getUint16(localPos+28,true);
  const dataStart=localPos+30+localNameLength+localExtra;
  check(dataStart+size<=view.getUint32(end+16,true),'Image tronquée dans le ZIP');
  check(decoder.decode(bytes.subarray(localPos+30,localPos+30+localNameLength))===name,'Nom ZIP incohérent');
  const data=bytes.slice(dataStart,dataStart+size);
  check(crc32(data)===crc,'Archive endommagée : contrôle CRC incorrect');
  result.set(name,data);
  pos+=46+nameSize+extra+comment;
 }
 check(pos===end&&NAMES.every(name=>result.has(name)),'Archive incomplète');
 return result;
}
function jpegValid(bytes){return bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255}
export async function createScanArchive(faces){
 check(Array.isArray(faces)&&faces.length===2,'Deux scans sont nécessaires');
 const manifest={format:'taquin-scans-v1',createdAt:new Date().toISOString(),
  size:768,landmarkSpace:'normalized-canonical-square',
  note:'Portraits recadrés 768x768 utilisés pour le rendu, pas les fichiers caméra originaux. Données biométriques privées.',
  faces:[]},images=[];
 for(let i=0;i<2;i++){
  const f=faces[i];
  check(landmarksValid(f?.landmarks),'Repères du visage '+(i+1)+' invalides');
  check(ringValid(f?.headRing),'Contour du visage '+(i+1)+' invalide');
  check(f.photoBlob instanceof Blob&&f.photoBlob.size>0&&f.photoBlob.size<=6*1024*1024,'Image du visage '+(i+1)+' invalide');
  const data=new Uint8Array(await f.photoBlob.arrayBuffer());
  check(jpegValid(data),'Le scan doit être une image JPEG');
  images.push(data);
  manifest.faces.push({image:NAMES[i+1],landmarks:f.landmarks,headRing:f.headRing||null,
   pose:f.pose||null,photometry:f.photometry||null,quality:f.quality||null,
   sharpness:Number.isFinite(f.sharpness)?f.sharpness:null});
 }
 const metadata=utf8.encode(JSON.stringify(manifest));
 check(metadata.length<=1024*1024&&images.reduce((s,b)=>s+b.length,metadata.length)<=LIMIT,'Archive trop volumineuse');
 return zipStore([[NAMES[0],metadata],[NAMES[1],images[0]],[NAMES[2],images[1]]]);
}
export async function readScanArchive(blob){
 check(blob instanceof Blob&&blob.size<=LIMIT&&blob.size>=22,'Sélectionne une archive ZIP Taquin valide (12 Mo maximum)');
 const entries=zipRead(new Uint8Array(await blob.arrayBuffer()));
 const metadata=entries.get(NAMES[0]);
 check(metadata.length<=1024*1024,'Métadonnées trop volumineuses');
 let manifest;
 try{manifest=JSON.parse(decoder.decode(metadata))}catch{throw new Error('Métadonnées JSON invalides')}
 check(manifest?.format==='taquin-scans-v1'&&manifest.size===768&&
  manifest.landmarkSpace==='normalized-canonical-square'&&Array.isArray(manifest.faces)&&manifest.faces.length===2,
  'Archive incompatible : format Taquin v1 requis');
 const faces=manifest.faces.map((f,i)=>{
  const data=entries.get(NAMES[i+1]);
  check(f?.image===NAMES[i+1]&&jpegValid(data)&&data.length<=6*1024*1024,'Image du visage '+(i+1)+' incorrecte');
  check(landmarksValid(f.landmarks)&&ringValid(f.headRing),'Repères ou contour du visage '+(i+1)+' incorrects');
  return {photoBlob:new Blob([data],{type:'image/jpeg'}),landmarks:f.landmarks,
   headRing:f.headRing||null,pose:f.pose,photometry:f.photometry,quality:f.quality,sharpness:f.sharpness};
 });
 return {faces,createdAt:manifest.createdAt};
}

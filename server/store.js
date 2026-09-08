import 'dotenv/config';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {challenges} from './catalog.js';

// One Express process owns this file. Writes are serialized and published atomically.
export const dataPath=resolve(process.env.DATA_FILE||'data/ecoverse.json');
await mkdir(dirname(dataPath),{recursive:true});
let state;
try { state=JSON.parse(await readFile(dataPath,'utf8')); }
catch(error){
 if(error.code!=='ENOENT')throw new Error('Cannot read EcoVerse data. Restore the data file before starting.',{cause:error});
 state={version:1,users:[],challenges:structuredClone(challenges),completions:[],transactions:[],badges:[]};
 await writeFile(dataPath,JSON.stringify(state,null,2),{flag:'wx',mode:0o600});
}
if(state.version!==1||!['users','challenges','completions','transactions','badges'].every(k=>Array.isArray(state[k])))throw new Error('Invalid EcoVerse data file. Existing data has not been overwritten.');
let queue=Promise.resolve();
// Additive upgrade: preserve all existing accounts and progress.
for(const key of ['goals','journal','purchases','placements','questClaims']){
 if(state[key]===undefined)state[key]=[];
 if(!Array.isArray(state[key]))throw new Error(`Invalid ${key} data; existing file was not changed.`);
}
export function readStore(){return structuredClone(state)}
export function changeStore(change){
 const operation=queue.then(async()=>{
   const next=structuredClone(state);const result=await change(next);
   const temporary=dataPath+'.tmp';await writeFile(temporary,JSON.stringify(next,null,2),{mode:0o600});
   await rename(temporary,dataPath);state=next;return structuredClone(result);
 });
 queue=operation.catch(()=>{});return operation;
}
export const nextId=rows=>rows.reduce((max,row)=>Math.max(max,row.id),0)+1;

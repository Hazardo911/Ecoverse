import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import {rateLimit} from 'express-rate-limit';
import {randomBytes,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {z} from 'zod';
import {readStore,changeStore,nextId} from './store.js';
import {forestFromPoints,badgeRules} from './progression.js';
import {featureRoutes,wallet} from './features.js';

const scrypt=promisify(scryptCallback),app=express();
const production=process.env.NODE_ENV==='production';
if(production && (!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32))throw new Error('Production requires SESSION_SECRET with at least 32 characters.');
app.disable('x-powered-by');
if(process.env.TRUST_PROXY==='1')app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:'550kb'}));
// Development sessions live in server memory. Account/progress data persists to JSON.
app.use(session({name:'eco.sid',secret:process.env.SESSION_SECRET||randomBytes(32).toString('hex'),resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:production,maxAge:7*86400000}}));
const fail=(status,message)=>Object.assign(new Error(message),{status});
const ok=(res,data,status=200)=>res.status(status).json({data});
app.use('/api',(req,res,next)=>{
 if(!['GET','HEAD','OPTIONS'].includes(req.method)){
   const allowed=new Set((process.env.APP_ORIGIN||'').split(',').map(s=>s.trim()).filter(Boolean));
   if(!production)for(const host of ['localhost','127.0.0.1'])for(const port of [5173,Number(process.env.PORT||3001)])allowed.add(`http://${host}:${port}`);
   if(req.get('origin')&&!allowed.has(req.get('origin')))return next(fail(403,'Request origin is not allowed.'));
   if(!req.is('application/json'))return next(fail(415,'Use application/json.'));
 }
 next();
});
function auth(req,res,next){const user=readStore().users.find(u=>u.id===req.session.userId);if(!user)return next(fail(401,'Please sign in to continue.'));req.user=user;next()}
function admin(req,res,next){req.user.role==='admin'?next():next(fail(403,'Administrator access required.'))}
function publicUser(user){const {password_hash,...profile}=user;return profile}
const today=()=>new Date().toISOString().slice(0,10);
const badgeCatalog=badgeRules.map(([id,name,description])=>({id,name,description}));
function progress(userId,data=readStore()){
 const completions=data.completions.filter(c=>c.user_id===userId);
 const ecoPoints=data.transactions.filter(t=>t.user_id===userId).reduce((sum,t)=>sum+t.points,0);
 return {ecoPoints,spendablePoints:wallet(userId,data).balance,...forestFromPoints(ecoPoints),ecoScore:Math.min(100,Math.floor(ecoPoints/25)),challengesCompleted:completions.length,
   completedChallenges:completions.filter(c=>c.completion_day===today()).map(c=>c.challenge_id),
   badges:data.badges.filter(b=>b.user_id===userId).map(b=>({...badgeCatalog.find(c=>c.id===b.badge_id),earned_at:b.earned_at}))};
}
async function hash(password){const salt=randomBytes(16).toString('hex');return `${salt}:${(await scrypt(password,salt,64)).toString('hex')}`}
async function verify(password,stored){const [salt,digest]=stored.split(':');const actual=await scrypt(password,salt,64),expected=Buffer.from(digest,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected)}
const credentials=z.object({email:z.string().trim().email().max(254).transform(s=>s.toLowerCase()),password:z.string().min(10).max(128)});
const authLimiter=rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:'draft-7',legacyHeaders:false,message:{error:{message:'Too many attempts. Try again later.'}}});
async function signIn(req,id){await new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));req.session.userId=id;await new Promise((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()))}
app.get('/api/health',(req,res)=>ok(res,{status:'ok',storage:'local-json',databaseRequired:false}));
app.post('/api/auth/register',authLimiter,async(req,res)=>{
 const input=credentials.extend({name:z.string().trim().min(2).max(80)}).parse(req.body);
 const password_hash=await hash(input.password);
 const user=await changeStore(data=>{
   if(data.users.some(u=>u.email===input.email))throw fail(409,'An account with this email already exists.');
   const user={id:nextId(data.users),name:input.name,email:input.email,password_hash,role:'user',avatar:null,created_at:new Date().toISOString()};data.users.push(user);return publicUser(user);
 });
 await signIn(req,user.id);ok(res,user,201);
});
app.post('/api/auth/login',authLimiter,async(req,res)=>{
 const input=credentials.parse(req.body),user=readStore().users.find(u=>u.email===input.email);
 if(!user||!await verify(input.password,user.password_hash))throw fail(401,'Email or password is incorrect.');
 await signIn(req,user.id);ok(res,publicUser(user));
});
app.post('/api/auth/logout',auth,(req,res,next)=>req.session.destroy(e=>{if(e)return next(e);res.clearCookie('eco.sid',{httpOnly:true,sameSite:'lax',secure:production});ok(res,{signedOut:true})}));
app.get(['/api/auth/me','/api/user/profile'],auth,(req,res)=>ok(res,publicUser(req.user)));
app.get('/api/challenges',(req,res)=>ok(res,readStore().challenges.filter(c=>c.is_active)));
app.get('/api/challenges/:id',(req,res)=>{const c=readStore().challenges.find(c=>c.id===Number(req.params.id)&&c.is_active);if(!c)throw fail(404,'Challenge not found.');ok(res,c)});
app.get(['/api/user/progress','/api/user/forest'],auth,(req,res)=>ok(res,progress(req.user.id)));
app.post('/api/challenges/:id/complete',auth,async(req,res)=>{
 z.object({}).strict().parse(req.body);const id=z.coerce.number().int().positive().parse(req.params.id);
 const result=await changeStore(data=>{
   const challenge=data.challenges.find(c=>c.id===id&&c.is_active);if(!challenge)throw fail(404,'Challenge is unavailable.');
   if(data.completions.some(c=>c.user_id===req.user.id&&c.challenge_id===id&&c.completion_day===today()))throw fail(409,'Already completed today. Return tomorrow for a new action.');
   const timestamp=new Date().toISOString();const completion={id:nextId(data.completions),user_id:req.user.id,challenge_id:id,title:challenge.title,category:challenge.category,completion_day:today(),completed_at:timestamp,status:'completed'};
   data.completions.push(completion);data.transactions.push({id:nextId(data.transactions),user_id:req.user.id,points:challenge.points,type:'challenge_completed',reference_id:completion.id,created_at:timestamp});
   const state=progress(req.user.id,data),newBadges=[];
   for(const [badge_id,name,,test] of badgeRules)if(test({points:state.ecoPoints,actions:state.challengesCompleted})&&!state.badges.some(b=>b.id===badge_id)){data.badges.push({user_id:req.user.id,badge_id,earned_at:timestamp});newBadges.push(name)}
   return {state:progress(req.user.id,data),newBadges,challenge};
 });ok(res,result,201);
});
app.get('/api/user/impact',auth,(req,res)=>{
 const data=readStore(),categories={},activity={};const first=new Date();first.setUTCDate(first.getUTCDate()-6);const start=first.toISOString().slice(0,10);
 for(const c of data.completions.filter(c=>c.user_id===req.user.id)){const category=data.challenges.find(x=>x.id===c.challenge_id)?.category||'lifestyle';categories[category]=(categories[category]||0)+1;if(c.completion_day>=start)activity[c.completion_day]=(activity[c.completion_day]||0)+1}
 ok(res,{...progress(req.user.id,data),categories:Object.entries(categories).map(([category,actions])=>({category,actions})),activity:Object.entries(activity).sort(([a],[b])=>a.localeCompare(b)).map(([date,actions])=>({date,actions})),estimatedCO2Kg:null,estimateNote:'Recorded actions do not yet include distances, energy use, or quantities. CO₂ estimates are unavailable until those measurements are collected.'});
});
app.get('/api/leaderboard',(req,res)=>{
 const period=z.enum(['global','weekly','monthly']).parse(req.query.period||'global'),data=readStore();const after=period==='global'?0:Date.now()-(period==='weekly'?7:30)*86400000;
 const rows=data.users.map(u=>{const transactions=data.transactions.filter(t=>t.user_id===u.id&&Date.parse(t.created_at)>=after);return {id:u.id,name:u.name,avatar:u.avatar,points:transactions.reduce((sum,t)=>sum+t.points,0),forestLevel:progress(u.id,data).forestLevel,challenges:transactions.length}}).filter(u=>u.points>0).sort((a,b)=>b.points-a.points||a.id-b.id).slice(0,100);ok(res,rows);
});
app.get('/api/badges',(req,res)=>ok(res,badgeCatalog));
app.get('/api/user/badges',auth,(req,res)=>ok(res,progress(req.user.id).badges));
app.use('/api/admin',auth,admin);
app.get('/api/admin/users',(req,res)=>ok(res,readStore().users.map(u=>({...publicUser(u),eco_score:progress(u.id).ecoScore})).reverse().slice(0,200)));
app.get('/api/admin/completions',(req,res)=>{const data=readStore();ok(res,data.completions.slice(-200).reverse().map(c=>({...c,name:data.users.find(u=>u.id===c.user_id)?.name,title:data.challenges.find(x=>x.id===c.challenge_id)?.title})))});
app.get('/api/admin/stats',(req,res)=>{const data=readStore();ok(res,{users:data.users.length,completions:data.completions.length,points:data.transactions.reduce((sum,t)=>sum+t.points,0)})});
app.get('/api/admin/challenges',(req,res)=>ok(res,readStore().challenges));
const challengeSchema=z.object({title:z.string().trim().min(3).max(100),description:z.string().trim().min(10).max(500),category:z.enum(['energy','water','waste','transport','lifestyle']),difficulty:z.enum(['Easy','Medium','Bold']),points:z.number().int().min(1).max(100),is_active:z.boolean()});
app.post('/api/admin/challenges',async(req,res)=>{const input=challengeSchema.parse(req.body);const id=await changeStore(data=>{const id=nextId(data.challenges);data.challenges.push({...input,id,slug:randomBytes(12).toString('hex'),icon:'leaf'});return id});ok(res,{id},201)});
app.patch('/api/admin/challenges/:id',async(req,res)=>{const input=challengeSchema.parse(req.body);await changeStore(data=>{const c=data.challenges.find(c=>c.id===Number(req.params.id));if(!c)throw fail(404,'Challenge not found.');Object.assign(c,input);return true});ok(res,{updated:true})});
app.use('/api/user',featureRoutes(auth,progress));
app.use('/api',(req,res,next)=>next(fail(404,'Endpoint not found.')));
app.use(express.static('dist',{index:'index.html'}));
app.use((err,req,res,next)=>{const status=err instanceof z.ZodError?400:err.status||500;if(status===500)console.error('Request failed:',err.code||err.message);res.status(status).json({error:{message:status===400?'Check the submitted fields.':status===500?'The service is temporarily unavailable. Please try again.':err.message}})});
export default app;

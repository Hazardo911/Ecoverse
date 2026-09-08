import {readStore,changeStore} from './store.js';
const email=process.argv[2]?.trim().toLowerCase();
if(!email)throw new Error('Usage: npm run admin:grant -- email@example.com');
if(!readStore().users.some(u=>u.email===email))throw new Error('Register an account with that email first.');
await changeStore(data=>{data.users.find(u=>u.email===email).role='admin';return true});
console.log('Administrator granted. Restart the backend if it is running.');

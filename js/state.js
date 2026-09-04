const DEFAULT_STATE={ecoPoints:0,completedChallenges:[],forestLevel:1,forestProgress:0,ecoScore:0,badges:[]};
const KEY='ecoverseState';
export function getUser(){try{return {...DEFAULT_STATE,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return {...DEFAULT_STATE}}}
export function saveUser(state){localStorage.setItem(KEY,JSON.stringify({...DEFAULT_STATE,...state}));window.dispatchEvent(new CustomEvent('eco:state',{detail:state}));return state}
export function getForestProgress(){return getUser()}
export function getChallenges(){return []}
export function completeChallenge(){return Promise.resolve(getUser())}


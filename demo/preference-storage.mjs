import {createAdaptiveReview} from '../src/adaptive-review.mjs';
// One synthetic demo scope per browser origin. No user/vendor identity claim.
// Access to storage is lazy and only occurs after explicit UI action.
const key='pwe:synthetic-demo:preferences:v1';
const limit=150000;
export function readPreferences(storage){
  const raw=storage.getItem(key);
  if(raw===null)return createAdaptiveReview();
  if(typeof raw!=='string'||raw.length>limit)throw new TypeError('Invalid saved profile');
  return createAdaptiveReview({profile:JSON.parse(raw)});
}
export function writePreferences(storage,adaptive){
  const raw=JSON.stringify(adaptive.exportProfile());
  if(raw.length>limit)throw new RangeError('Preference storage limit');
  storage.setItem(key,raw);
}
export function removePreferences(storage){storage.removeItem(key);}

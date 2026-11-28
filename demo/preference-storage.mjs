// Legacy alpha migration: delete the origin-wide profile without reading it.
// Public demo now uses memory-only preferences.
const key='pwe:synthetic-demo:preferences:v1';
export function removePreferences(storage){storage.removeItem(key);}

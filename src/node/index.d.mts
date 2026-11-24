import type {Provider} from '../index.mjs';
export function createVale(options:{executable:string;config:string}):Provider;
export function createSTE100(options:{executable:string}):Provider;
export function createLocalLanguageTool(options?:{endpoint?:string}):Provider;

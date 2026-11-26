import {defineConfig} from 'vite';
import pkg from '../package.json';
import {dictionaryPlugin} from './dictionary-plugin.mjs';
export default defineConfig({
  plugins:[dictionaryPlugin(),{
    name:'pwe-demo-version',
    transformIndexHtml(html){return html.replace('__PWE_VERSION__',pkg.version);}
  }],
  worker:{format:'es',plugins:()=>[dictionaryPlugin()]},
  build:{target:'es2022'}
});

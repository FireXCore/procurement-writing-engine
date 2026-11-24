import {defineConfig} from 'vite';
import pkg from '../package.json';
export default defineConfig({
  plugins:[{
    name:'pwe-demo-version',
    transformIndexHtml(html){return html.replace('__PWE_VERSION__',pkg.version);}
  }],
  worker:{format:'es'},
  build:{target:'es2022'}
});

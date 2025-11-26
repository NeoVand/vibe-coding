import { uniforms } from './uniforms';
import { path } from './path';
import { utils } from './utils';
import { noise } from './noise';
import { lightning } from './lightning';
import { map } from './map';
import { raymarch } from './raymarch';
import { render } from './render';
import { main } from './main';

export { vertexShader } from './vertex';

export const fragmentShader = [
    uniforms,
    path,
    utils,
    noise,
    lightning,
    map,
    raymarch,
    render,
    main
].join('\n');


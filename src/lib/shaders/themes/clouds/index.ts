import { baseUniforms, path, utils, main } from '../../core';
import { cloudUniforms } from './uniforms';
import { noise } from './noise';
import { lightning } from './lightning';
import { map } from './map';
import { raymarch } from './raymarch';
import { render } from './render';

export { vertexShader } from '../../core/vertex';

export const fragmentShader = [
    baseUniforms,
    cloudUniforms,
    path,
    utils,
    noise,
    lightning,
    map,
    raymarch,
    render,
    main
].join('\n');

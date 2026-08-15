// app.js

// :::::: IMPORTS :::::::::::::::::::::::::::::::::::::::::::

// ::: app
import * as app    from './../shared/js/app.js';
import * as config from './app.config.js';
import { vfs }     from './../shared/js/vfs.js';

// ::: vendors
import aufbau, { html, dom, preact } from '@aufbau/kits/preact-htm';

// :::::: CONFIG ::::::::::::::::::::::::::::::::::::::::::::

aufbau.init();
app.adoptStyleSheets(app.css);

// :::::: APP :::::::::::::::::::::::::::::::::::::::::::::::

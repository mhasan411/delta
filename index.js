'use strict';
/**
 * Imports
 */
const express = require('express');
const app = express();
const path = require('path');
const reqLib = require('app-root-path').require;
const job = reqLib('core/cron');
const { env, domainUrl } = reqLib('config');
const { promisify } = require('util');
const db = reqLib('core/db');
const logger = reqLib('core/logger');
const expressip = require('express-ip');
const fileUploader = reqLib('core/files/fileUploader');
const bodyParser = require('body-parser');
const urlShortner = reqLib('core/urls/urlShortner');
const getFile = reqLib('core/files/getFile');

/**
 * Middlewares and inits
 */
const DOMAIN = env === 'PROD' ? domainUrl : 'http://localhost:3000/'; // Mind the trailing slash (/)
logger.info(`Server started at ${DOMAIN}`);

db.defaults({ collection: [], deleted: [], uniqueID: 10000 }).write();
app.use(expressip().getIpInfoMiddleware);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

express.response.sendFile = promisify(express.response.sendFile);

const uploadsPath = (childPath = '') => {
    return path.resolve(__dirname, 'uploads', childPath);
};

if (env === 'PROD') {
    job.start();
    logger.info('Cronjob starting in production mode');
}
/**
 * POST method to upload file
 */
app.post('/', (req, res) => {
    const requestBody = req.body;
    if (!requestBody.url) {
        logger.info('Uploading file');
        fileUploader(req, res);
    } else {
        logger.info('Shortening URL');
        urlShortner(req, res);
    }
});

app.get('/favicon.ico', (req, res) => res.sendFile(uploadsPath('../favicon.ico')));

app.get('/:file', (req, res, next) => {
    // console.log(req.headers['user-agent']);
    const requestedFile = req.params.file;
    logger.info('Serving file ' + requestedFile);
    const record = db.get('collection').find({ short: requestedFile }).value();
    if (record && record.type === 'file') {
        const fileName = record.filename;
        getFile(fileName, req, res);
    } else if (record && record.type === 'url') {
        res.redirect(record.originalURL);
    } else {
        res.end('Cannot find the specified record');
    }
});

app.listen(3000, () => console.log(`Server started at ${DOMAIN}`));

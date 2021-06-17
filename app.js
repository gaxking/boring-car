const { exec } = require('child_process');
const express = require('express');
const app = express();
const path = require('path')
const fs= require('fs');
const credentials = require('./ssl');
const https = require('https')


app.use('/client', express.static(path.join(__dirname, './client')))

const httpsServer = https.createServer(credentials, app)
const SSLPORT = 5000
httpsServer.listen(SSLPORT, function () {
  console.log('HTTPS Server is running on: https://localhost:%s', SSLPORT)
});

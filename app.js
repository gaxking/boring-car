const { exec } = require('child_process');
const express = require('express');
const app = express();
const path = require('path')
const fs= require('fs');
const credentials = require('./ssl');
const https = require('https')

const webappPath = '/home/pi/work/boring-car';

app.get('/reload', function (req, res) {
  let cmdStr = `pm2 restart app`

  exec(cmdStr, (err, stdout, stderr) => {
    res.end(`stdout: ${stdout}\nstderr: ${stderr}`);
  });
});

//更新git
app.get('/update', function (req, res) {
  let cmdStr = '';
  let path = `${webappPath}`;

  cmdStr = `cd ${path} && git pull`;
  exec(cmdStr, (err, stdout, stderr) => {
    res.end(`stdout: ${stdout}\nstderr: ${stderr}`);
  });
});


app.use('/client', express.static(path.join(__dirname, './client')))

const httpsServer = https.createServer(credentials, app)
const SSLPORT = 5000
httpsServer.listen(SSLPORT, function () {
  console.log('HTTPS Server is running on: https://localhost:%s', SSLPORT)
});

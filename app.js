const { exec } = require('child_process');
const express = require('express');
const app = express();
const path = require('path')
const fs= require('fs');
const credentials = require('./ssl');
const https = require('https');
const WebSocket = require('ws');


app.use('/client', express.static(path.join(__dirname, './client')))
const server = https.createServer(credentials, app)

const wss = new WebSocket.Server({ server });

function spanPromise({py, hz, order}) {
  return new Promise((resolve,reject)=>{
    const pythonProcess = child_process.spawn('python', [`/home/pi/work/stepper-motor/stepper-${py}.py`, hz, order]);
    resolve(pythonProcess)
  })
}

let carProcess = null;
let t = null;
wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(data) {
    data = JSON.parse(data);

    if(!carProcess){
      const definedQuery = {hz:6400, order:"forward"};
      const {hz, order, sec} = {...definedQuery, ...data};
      carProcess = await spanPromise({py:"soft", hz, order});
      t = setTimeout(async ()=>{
        carProcess.kill();
        carProcess=null;
        t=null;
        await spanPromise({py:"stop"})
      }, 1000)
    }else if(t!==null){
      t = setTimeout(async ()=>{
        carProcess.kill();
        carProcess=null;
        t=null;
        await spanPromise({py:"stop"})
      }, 1000)
    }

    console.log('received: %s', data);
  });

  ws.send('something');
});

const SSLPORT = 5000
server.listen(SSLPORT, function () {
  console.log('HTTPS Server is running on: https://localhost:%s', SSLPORT)
});

const { exec } = require('child_process');
const express = require('express');
const app = express();
const path = require('path')
const fs= require('fs');
const credentials = require('./ssl');
const https = require('https');
const WebSocket = require('ws');
const child_process = require('child_process');

app.use('/client', express.static(path.join(__dirname, './client')))
const server = https.createServer(credentials, app)

const wss = new WebSocket.Server({ server });

function spanPromise({py, hz, order}) {
  return new Promise((resolve,reject)=>{
    const pythonProcess = child_process.spawn('python', [`/home/pi/work/stepper-motor/stepper-${py}.py`, hz, order]);
    resolve(pythonProcess)
  })
}

function mgPromise({deg}) {
  return new Promise((resolve,reject)=>{
    const pythonProcess = child_process.spawn('python', [`/home/pi/work/mg-moter/main.py`, deg]);
    resolve(pythonProcess)
  })
}

function ultrasoundPromise(dir){
  return new Promise((resolve,reject)=>{
    const pythonProcess = child_process.spawn('python', [`/home/pi/work/ultrasound/index-${dir}.py`]);

   pythonProcess.stdout.on('data', function (data) {
      resolve(data.toString().trim());
   });

   pythonProcess.stdout.on('data', function (data) {
      console.log('stdout: ' + data);
   });

   pythonProcess.on('close', function (code) {
      console.log('子进程已退出，退出码 '+code);
   });

  })
}

let carProcess = null;
let t = null;
wss.on('connection', function connection(ws) {
  ws.on('message', async function incoming(data) {
    data = JSON.parse(data);

    const stop = async ()=>{
      carProcess.kill();
      carProcess=null;
      t=null;
      await spanPromise({py:"stop"})
    }

    if(!carProcess){
      const definedQuery = {hz:6400, order:"forward"};
      const {hz, order, sec} = {...definedQuery, ...data};
      carProcess = await spanPromise({py:"soft", hz, order});
      t = setTimeout(stop, 200)
    }else if(t!==null){
      clearTimeout(t);
      t = setTimeout(stop, 200)
    }

    console.log('received: %s', data);
  });

  ws.on('close', ()=>{
    console.log("close");
    ultrasound = null;
  });

  ws.on('error', ()=>{
    console.log("error");
    ultrasound = null;
  });


  let ultrasound =  async ()=>{
    console.log("111", !!ultrasound);
    const [left, right] = await Promise.all([ultrasoundPromise('left'), ultrasoundPromise('right')]);

    ws.send(JSON.stringify({
      action:'ultrasound',
      left,
      right
    }));


    console.log("222", !!ultrasound);

    ultrasound  && setTimeout(ultrasound, 10);
  }

  ultrasound();

  ws.send('connet finsh');
});

let mgProcess = null;
app.get('/mg', async (req, res) => {
   const {deg} = {...req.query};

   if(mgProcess){
      mgProcess.kill();
      mgProcess = null;
   }

   if(deg==='0'){
      res.send('')
      return;
   }

   mgProcess = await mgPromise({deg});
   res.send('')
})

const SSLPORT = 5000
server.listen(SSLPORT, function () {
  console.log('HTTPS Server is running on: https://localhost:%s', SSLPORT)
});

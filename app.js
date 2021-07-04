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

   let res;
   pythonProcess.stdout.on('data', function (data) {
      res = parseInt(data.toString().trim(), 10);
   });

   pythonProcess.stderr.on('data', function (data) {
      resolve(-1);
   });

   pythonProcess.on('close', function (code) {
      resolve(res);
   });

    setTimeout(()=>{
      pythonProcess.kill();
      resolve(-1);
    }, 150)
  })
}

let carProcess = null;
let t = null;
wss.on('connection', function connection(ws) {
  let mCARDIR = null;
  let mDISTANCE = {left:null, right:null}
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
      mCARDIR = order;
      carProcess = await spanPromise({py:"soft", hz, order});
      t = setTimeout(stop, 200)
    }else if(t!==null){
      clearTimeout(t);
      t = setTimeout(stop, 200)
    }else if((mDISTANCE.left < 8 || mDISTANCE.right < 8) && mCARDIR === 'forward'){
      stop();
    }

    console.log('received: %s', data);
  });

  ws.on('close', ()=>{
    ultrasound = null;
  });

  ws.on('error', ()=>{
    ultrasound = null;
  });


  let ultrasound =  async (dir)=>{
    console.log("dir", dir);
    const distance = await ultrasoundPromise(dir);
    mDISTANCE[dir] = distance;
    ws.send(JSON.stringify({
      action:'ultrasound',
      dir,
      distance
    }));

    if(distance < 8 && mCARDIR === 'forward'){
      stop();
    }

    ultrasound  && setTimeout(()=>{ultrasound(dir)}, 0);
  }

  ultrasound('left');
  ultrasound('right');

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

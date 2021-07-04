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
    console.log(5, order);

    if(order==='stop'){
      setTimeout(()=>{
        pythonProcess.kill();
        resolve(-1);
      }, 150)
    }

  })
}

function mgPromise({deg}) {
  return new Promise((resolve,reject)=>{
    const pythonProcess = child_process.spawn('python', [`/home/pi/work/mg-moter/main.py`, deg]);
    resolve(pythonProcess)
  })
}

function ultrasoundPromise(){
  return new Promise((resolve,reject)=>{
    const pythonProcess = child_process.spawn('python', [`/home/pi/work/ultrasound/index.py`]);

   let res;
    pythonProcess.stdout.on('data', function (data) {
      const [left, right] = data.toString().split(/[^\d\.]+/);
      res = {
        left:parseInt(left, 10),
        right:parseInt(right, 10)
      }
   });

   pythonProcess.stderr.on('data', function (data) {
      resolve({left:-1, right:-1});
   });

   pythonProcess.on('close', function (code) {
      resolve(res);
   });

    setTimeout(()=>{
      pythonProcess.kill();
      resolve({left:-1, right:-1});
    }, 250)
  })
}

let carProcess = null;
let t = null;
wss.on('connection', function connection(ws) {
  let mCARDIR = null;
  let mDISTANCE = {left:null, right:null};

  const stop = async ()=>{
    console.log(6);
    carProcess && carProcess.kill();
    carProcess=null;
    t=null;

    if(mCARDIR !== 'stop'){
      mCARDIR = 'stop';
      await spanPromise({py:"stop"})
      mCARDIR = null;
    }
  }

  ws.on('message', async function incoming(data) {
    data = JSON.parse(data);

    if(((mDISTANCE.left < 8 && mDISTANCE.left !== -1)  || (mDISTANCE.right < 8 && mDISTANCE.right !== -1)) && mCARDIR === 'forward'){
      console.log(4);
      await stop();
    }else if(!carProcess){
      const definedQuery = {hz:6400, order:"forward"};
      const {hz, order, sec} = {...definedQuery, ...data};
      mCARDIR = order;
      console.log(2, order);
      carProcess = await spanPromise({py:"soft", hz, order});
      t = setTimeout(stop, 200)
    }else if(t!==null){
      console.log(3);
      clearTimeout(t);
      t = setTimeout(stop, 200)
    }

    console.log('received: %s', data);
  });

  ws.on('close', ()=>{
    ultrasound = null;
  });

  ws.on('error', ()=>{
    ultrasound = null;
  });


  let ultrasound =  async ()=>{
    const distance = await ultrasoundPromise();
    mDISTANCE = distance;
    ws.send(JSON.stringify({
      action:'ultrasound',
      ...distance
    }));

    if(((mDISTANCE.left < 8 && mDISTANCE.left !== -1)  || (mDISTANCE.right < 8 && mDISTANCE.right !== -1)) && mCARDIR === 'forward'){
      console.log(7);
      await stop();
    }

    setTimeout(()=>{
      ultrasound  && ultrasound();
    }, 150)
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

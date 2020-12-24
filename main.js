const fs = require('fs');
var fetch = require('node-fetch');
var request = require('request');
var express = require('express');
var intoStream = require('into-stream');
var bodyParser = require('body-parser');
var textParser = bodyParser.text({ limit: '50kb' });

async function register ({
  registerHook,
  registerSetting,
  settingsManager,
  storageManager,
  videoCategoryManager,
  videoLicenceManager,
  videoLanguageManager,
  peertubeHelpers,
  getRouter
  }) {
  console.log('outside register')

  registerSetting({
    name: 'rpc-path',
    label: 'Nano node RPC path',
    type: 'input',
    private: false,
    default: "http://178.62.20.168:8076"
  })

  registerHook({
    target: 'action:application.listening',
    handler: () => console.log("what the fucking fuck")
  })

  var url = await settingsManager.getSetting("rpc-path")

  const router = getRouter()

  router.get('/getpath', function(req, res) {
    res.send(__dirname);
  })

  // pow.js wants a relative path for pow.wasm, but the polyfill breaks it.
  // here we set an absolute path and point pow.js to it. sickening, i know
  router.get('/pow.wasm', function(req, res) {
    fs.readFile(__dirname + '/client/wasm-pow/pow.wasm', (err, data) => {
      if (err) res.send(err.message)
      res.send(data)
    })
  })

  router.get('/thread.js', function(req, res) {
    fs.readFile(__dirname + '/client/wasm-pow/thread.js', (err, data) => {
      if (err) res.send(err.message)
      res.set('Content-Type', 'application/javascript')
      res.send(data)
    })
  })

  router.get('/pow.js', function(req, res) {
    fs.readFile(__dirname + '/client/wasm-pow/pow.js', (err, data) => {
      if (err) res.send(err.message)
      res.set('Content-Type', 'application/javascript')
      res.send(data)
    })
  })

  router.get('/nanonode', function(req, res) {
    req.pipe(request(url)).pipe(res);
  })

  router.use(bodyParser.raw({
    inflate: true,
    limit: '100kb',
    type: 'application/octet-stream'
  }))

  var jsonParser = bodyParser.json()

  router.post('/nanonode', jsonParser, async function(req, res) {
    url = await settingsManager.getSetting("rpc-path")
      request.post({ url: url, body: JSON.stringify(req.body)}, function(error, response, body) {
        try {
          res.send('{"error": "cannot connect to rpc server"}')
        } catch(err) {
          // weird hack stops crashing on header duplication
          return
        }
      }).pipe(res)
          .on("error", function(e){
            res.send('{"error": "pipe error"}')
      }, function() {
        res.send('{"error":"reached second functon')
      });    
  })
}

async function unregister () {
  return
}

module.exports = {
  register,
  unregister
}


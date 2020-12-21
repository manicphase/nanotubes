//import { wallet } from '../node_modules/nanocurrency-web/dist/index.min.js'

//import { wallet } from "nanocurrency-web";

var walletSeed;
var settings

async function register ({ registerHook, peertubeHelpers }) {
  settings = await peertubeHelpers.getSettings()
  
  registerHook({
    target: 'action:application.init',
    handler: () => configureWallet(peertubeHelpers)
  })


  // add listener to menu icon
  var icon = document.getElementsByClassName("icon-menu")[0]
  icon.addEventListener("click", injectPanel)

  var nano_div
  var show_details = true
  var details_panel
  var panel_body
  window.worker_status = "Idle"

  // inject nano panel in menu. needs some work
  function injectPanel() {
    var pb = document.getElementsByClassName("panel-block")[0]
    if (pb) {
      panel_body = "<div id='nano_panel'>" +
                      '<div id="nano_header">NANO WALLET (click to open/close)<br>' +
                      '<div id="balance">Balance: 0</div></div><br>' + 
                      '<div id="wallet_details" style="display:none;">scan or click to copy to clipboard<br>' + 
                      "<canvas id='qr_canvas'></canvas><br>" +
                      'Your address:<input type="text" value="" id="nano_address"><br>' +
                      'Seed:<input type="text" value="" id="nano_seed"><br><br>' +
                      'Send to:<input type="text" value="" id="target_address"><br>' +
                      'Amount:<input type="text" value="" id="send_amount"><br>' +
                      '<input id="send_button" type="submit" value="Send"/>'+
                      "</div></div>"

      let panel_body_div = document.createElement("div")
      panel_body_div.innerHTML = panel_body
      pb.parentNode.insertBefore(panel_body_div, pb)
      if (window.wallet) {
        var qrCanvas = document.getElementById("qr_canvas")
        QRCode.toCanvas(qrCanvas, window.wallet.accounts[0].address, function (error) {
          if (error) console.error(error)
          console.log('success!');
        })
        qrCanvas.addEventListener("click", copyToClipboard)
        var nanoAddressBox = document.getElementById("nano_address")
        nanoAddressBox.value = window.wallet.accounts[0].address
        nano_div = document.getElementById("balance")
        try {
          let nano_value = NanocurrencyWeb.tools.convert(account_info.balance, 'RAW', 'NANO')
          nano_div.innerText = "Balance: " + Math.round(nano_value * 100) / 100 +
                               "\nStatus: " + window.worker_status
        } catch (e) {
          console.log(e.name)
        }

        details_panel = document.getElementById("wallet_details")
        document.getElementById("nano_header").addEventListener("click", function() {
          if (show_details) {
            details_panel.style.display = "block"
          } else {
            details_panel.style.display = "none"
          }
          show_details = !show_details
        })

        document.getElementById("nano_seed").value = window.wallet.seed
        
        //send
        document.getElementById('send_button').onclick = function() {
          let target_address = document.getElementById("target_address").value
          let nano_value = document.getElementById("send_amount").value
          let raw_send = NanocurrencyWeb.tools.convert(nano_value, 'NANO', 'RAW')
          sendNano(raw_send, target_address)
        }
      }
    }
  }

  const rpc_path = "/plugins/nanotubes/router/nanonode"

  function copyToClipboard() {
    var nanoAddressBox = document.getElementById("nano_address")
    nanoAddressBox.select()
    nanoAddressBox.setSelectionRange(0, 99999)
    document.execCommand("copy")
  }

  var proofOfWork;
  var minerIdle = true;

  walletSeed = localStorage.getItem("wallet_seed")
  if (walletSeed) {
    console.log("recovering wallet from localStorage")
    window.wallet = NanocurrencyWeb.wallet.fromSeed(walletSeed)
  } else {
    console.log("generating wallet...")
    window.wallet = NanocurrencyWeb.wallet.generate();
    walletSeed = window.wallet.seed
    localStorage.setItem("wallet_seed", walletSeed)
  }

  var my_address = window.wallet.accounts[0].address
  var new_account = false

  var account_info;
  async function getInfo() {
    console.log("get info...", my_address)
    //await getInfo(rpc_path, my_address).then(result => {account_info = result})
    await getSingle(rpc_path, "account_info", my_address).then(result => {account_info = result})
    console.log(account_info)
    console.log("got info")
    console.log(account_info.error)
    if (account_info.error == "Account not found") {
      new_account = true
    } else {
      new_account = false
    }
    try {
      let nano_value = NanocurrencyWeb.tools.convert(account_info.balance, 'RAW', 'NANO')
      nano_div.innerText = "Balance: " + Math.round(nano_value * 100) / 100 +
                           "\nStatus: " + window.worker_status
    } catch (e) {
      console.log(e.name)
    }
  }
  getInfo()

  var difficulty;
  await getDifficulty(rpc_path).then(result => {difficulty = result})
  console.log(difficulty)

  console.log("get history...", my_address)
  var history;
  await getSingle(rpc_path, "account_history", my_address).then(result => {history = result})
  console.log(history)
  console.log("got history")

  console.log("get pending...", my_address)
  var pending;
  await getMulti(rpc_path, "accounts_pending", my_address).then(result => {pending = result})
  console.log(pending)
  console.log("got pending")

  async function getPending() {
    await getMulti(rpc_path, "accounts_pending", my_address).then(result => {pending = result})
    console.log(pending)
    let pending_blocks = pending.blocks[my_address]
    for (var i=0; i<pending_blocks.length; i++) {
      console.log("add block")
      let job = {"type": "pending",
                 "block_hash": pending_blocks[i]}
      addJob(job)
      console.log("added block")
    }
  }
  getPending()
  setInterval(getPending, 10000)
  setInterval(getInfo, 10000)


  // is this redundant??
  window.addEventListener('storage', () => {
    console.log("storage called")
    processJob();
  });

  let job_queue = JSON.parse(localStorage.getItem("nano_job_queue"))
  if (job_queue == undefined) {
    let job_queue = []
    localStorage.setItem("nano_job_queue", JSON.stringify(job_queue))
  }

  function addJob(job) {
    console.log("adding job", job)
    let job_string = localStorage.getItem("nano_job_queue")
    let job_queue = JSON.parse(job_string)
    // put pending at front, spending at back
    if (job.type == "pending") {
      let existing = job_queue.filter(listed_job => listed_job.block_hash == job.block_hash);
      if (existing.length == 0) {
        job_queue.unshift(job)
      } else {
        console.log("job already listed")
      }
    } else {
      job_queue.push(job)
    }
    localStorage.setItem("nano_job_queue", JSON.stringify(job_queue))
    processJob()
  }

  window.addJob = addJob

  function processJob() {
    console.log("processing Job. miner idle:", minerIdle)
    if (minerIdle) {
      let job_queue = JSON.parse(localStorage.getItem("nano_job_queue"))
      if (job_queue.length == 0) {
        return
      }
      console.log("queue:", job_queue)
      let job = job_queue.shift()
      localStorage.setItem("nano_job_queue", JSON.stringify(job_queue))
      console.log("do job", job)
      minerIdle = false
      if (job.type == "pending") {
        console.log("do pending job")
        if (new_account) {
          openAccount(job.block_hash)
        } else {
          receiveNano(job.block_hash)
        }
      }
      
      if (job.type == "send") {
        console.log("DOING SEND JOB", job)
        sendNano(job.amount, job.address)
      }
    }
  }

  setInterval(processJob, 10000)

  async function openAccount(pending_block) {
    window.worker_status = "Opening Account"
    console.log("OPEN ACCOUNT")
    let block_details
    await getBlockInfo(rpc_path, pending_block).then(result => {block_details = result})
    console.log(block_details)
    let receive_block_data = {
      "action": "process",
      "json_block": "true",
      "subtype": "open",
      "block": {
        walletBalanceRaw: '00000000000000000000000000000000',
        toAddress: window.wallet.accounts[0].address,
        representativeAddress: 'nano_1stofnrxuz3cai7ze75o174bpm7scwj9jn3nxsn8ntzg784jf1gzn1jjdkou',
        frontier: '0000000000000000000000000000000000000000000000000000000000000000',
        transactionHash: pending_block,
        amountRaw: block_details.amount,
    }
    }
    console.log("MADE RECEIVE BLOCK")
    console.log(receive_block_data)
    
    let preppedReceiveBlock = setUpReceiveBlock(receive_block_data)
    //console.log(account_info.balance, send_block_data.block.frontier, preppedSendBlock, setStatus)
    NanoWebglPow(window.wallet.accounts[0].publicKey, preppedReceiveBlock, setStatus, "0x"+difficulty.network_receive_current.slice(0,8))
  }

  function sendNano(send_amount, to_address) {
    window.worker_status = "Sending Nano"
    console.log("SEND NANO")
    if (parseInt(send_amount) > parseInt(account_info.balance)) {
      send_amount = account_info.balance
    }
    if (send_amount == 0) {
      return
    }
    let send_block_data = {
      "action": "process",
      "json_block": "true",
      "subtype": "send",
      "block": {
          walletBalanceRaw: account_info.balance,
          fromAddress: window.wallet.accounts[0].address,
          toAddress: to_address,
          representativeAddress: 'nano_1stofnrxuz3cai7ze75o174bpm7scwj9jn3nxsn8ntzg784jf1gzn1jjdkou',
          frontier: account_info.frontier,
          amountRaw: send_amount,
        }
    }
    console.log("MADE SEND BLOCK")
    console.log(send_block_data)

    let preppedSendBlock = setUpSendBlock(send_block_data)
    console.log(account_info.balance, send_block_data.block.frontier, preppedSendBlock, setStatus)
    NanoWebglPow(send_block_data.block.frontier, preppedSendBlock, setStatus, "0x"+difficulty.network_current.slice(0,8))
  }

  async function receiveNano(pending_block) {
    window.worker_status = "Receiving Nano"
    console.log("RECEIVE NANO")
    let block_details
    await getBlockInfo(rpc_path, pending_block).then(result => {block_details = result})
    console.log(block_details)
    let receive_block_data = {
      "action": "process",
      "json_block": "true",
      "subtype": "receive",
      "block": {
        walletBalanceRaw: account_info.balance,
        toAddress: window.wallet.accounts[0].address,
        representativeAddress: 'nano_1stofnrxuz3cai7ze75o174bpm7scwj9jn3nxsn8ntzg784jf1gzn1jjdkou',
        frontier: account_info.frontier,
        transactionHash: pending_block,
        amountRaw: block_details.amount,
      }
    }
    console.log("MADE RECEIVE BLOCK")
    console.log(receive_block_data)
    
    let preppedReceiveBlock = setUpReceiveBlock(receive_block_data)
    //console.log(account_info.balance, send_block_data.block.frontier, preppedSendBlock, setStatus)
    console.log("RECEIVE", receive_block_data.block.frontier)
    NanoWebglPow(receive_block_data.block.frontier, preppedReceiveBlock, setStatus, "0x"+difficulty.network_receive_current.slice(0,8))
  }


  function setUpReceiveBlock(block) {
    console.log("initiating receive block with", block)
    return async function(pow) {
      let target = block.block.toAddress
      console.log("POW FOUND!");
      block.block["work"] = pow
      console.log(pow);
      let signed_block = NanocurrencyWeb.block.receive(
            block.block, 
            window.wallet.accounts[0].privateKey)
      signed_block.link_as_account = target //window.wallet.accounts[0].address
      block.block = signed_block
      console.log(block)
      insertBlock(rpc_path, block).then(result => {console.log(result)})
      await getInfo().then(() => {minerIdle = true})
      window.worker_status = "Idle"
      /*await getSingle(rpc_path, "account_info", my_address).then(result => {
        account_info = result;
        minerIdle = true;
      })*/
    }
  }
  

  function setUpSendBlock(block) {
    console.log("initiating send block with", block)
    return async function(pow) {
      let target = block.block.toAddress
      console.log("POW NOW FOUND", pow)
      block.block["work"] = pow
      let signedSendBlock = NanocurrencyWeb.block.send(
            block.block, 
            window.wallet.accounts[0].privateKey)
      block.block = signedSendBlock
      block.block.link_as_account = target
      console.log(block)
      insertBlock(rpc_path, block).then(result => {console.log(result)})
      await getInfo().then(() => {minerIdle = true})
      window.worker_status = "Idle"
      /*await getSingle(rpc_path, "account_info", my_address).then(result => {
        account_info = result;
        minerIdle = true;
      })*/
    }
  }

  function configureWallet(peertubeHelpers) {
    injectPanel()
  }

  function setStatus(text) {
    console.log(text);
  }
}


async function insertBlock(rpc_path, block) {
  console.log("sending block")
  let request = await fetch(rpc_path, {
    method: "POST",
    body: JSON.stringify(block),
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }, 
  })
  let response = await request.json()
  return response
}

async function getDifficulty(rpc_path) {
  console.log("contacting...", rpc_path)
  let request = await fetch(rpc_path, {
    method: "POST",
    body: JSON.stringify({"action": "active_difficulty"}),
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
  })
  let response = await request.json()
  return response
}

async function getSingle(rpc_path, action, account) {
  console.log("contacting...", rpc_path)
  let body_string = '{"action":"' + action + '", "account":"' + account + '", "count":-1}'
  let request = await fetch(rpc_path, {
    method: "POST",
    body: JSON.stringify({"action": action, "account": account, "count":"-1"}),
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
  })
  let response = await request.json()
  return response
}

async function getMulti(rpc_path, action, accounts) {
  console.log("contacting...", rpc_path)
  let account_string
  if (typeof(accounts == "string")) {
    account_string = '["' + accounts + '"]'
  } 
  let body_string = '{"action":"' + action + '", "accounts":' + account_string + ', "count":-1}'
  console.log(body_string)
  let request = await fetch(rpc_path, {
    method: "POST",
    body: body_string,
    headers: {
      'Content-Type': 'application/json'
    },
  })
  let response = await request.json()
  return response
}

async function getBlockInfo(rpc_path, blockId) {
  console.log("contacting...", rpc_path)
  let body_string = '{"action":"block_info", "json_block":"true", "hash": "' + blockId + '"}'
  console.log(body_string)
  let request = await fetch(rpc_path, {
    method: "POST",
    body: body_string,
    headers: {
      'Content-Type': 'application/json'
    },
  })
  let response = await request.json()
  return response
}

export {
  register
}
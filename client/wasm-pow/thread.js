self.importScripts('/plugins/nanotubes/router/pow.js');

var ready = false;

Module['onRuntimeInitialized'] = function() {
    postMessage('ready');
}

onmessage = function(ev)
{
	console.log("IN POW THING")
    var PoW = Module.cwrap("launchPoW", 'string', ['string']);
    var hash = ev.data;
	//let generate = Module.ccall("launchPoW", 'string', ['string'], hash);
	let generate = PoW(hash);
	
	if (generate != "0000000000000000") {
	    console.log(generate +" found");
		postMessage(generate); // Worker return
	}
	else
	{
	    postMessage(false);
	}
}

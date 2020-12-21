async function register ({ registerHook, peertubeHelpers }) {
    settings = await peertubeHelpers.getSettings()

    console.log("inside register")
}

async function checkForAddress(details_path) {
    let request = await fetch(details_path)
    let response = await request.json()
    console.log(response)
    parseSupport(response.support)
}

var href
var time_out
var donation_address
var raw_donation_amount

function parseSupport(support_text) {
    if (support_text != undefined) {
        let addresses = support_text.match(/nano_.{60}/gm)
        if (addresses.length > 0) {
            console.log("address found", addresses)
            donation_address = addresses[0]
            window.worker_status = "Found donation address"
        } else {
            donation_address = undefined
        }
    } else {
        donation_address = undefined
    }
}

function pathChanged() {
    let this_href = document.location.href
    if (this_href != href) { 
        console.log("PATH CHANGED!")
        href = this_href
        let lp = href.split("/")
        let video_id = lp[lp.length-1]
        var details_path = "/api/v1/videos/" + video_id
        console.log(details_path)
        checkForAddress(details_path)
        setTimeout(setVideoDuration, 10000)
        try {
            clearTimeout(time_out)
        } catch (e) {
            console.log("no timeout to clear")
        }
    }
}

setInterval(pathChanged, 1000)

function setVideoDuration() {
    let video_duration = document.getElementsByTagName("video")[0].duration
    console.log(video_duration)
    time_out = setTimeout(donate, (video_duration/2) * 1000)
    let donation_amount = (video_duration / 60) * 0.01
    console.log("donation_amount", donation_amount)
    raw_donation_amount = NanocurrencyWeb.tools.convert(donation_amount, 'NANO', 'RAW')
}

function donate() {
    console.log("DONATE NOW")
    if (donation_address != undefined)
    {
        let newJob = {
            "type": "send",
            "amount" : raw_donation_amount,
            "address" : donation_address
        }
        console.log("adding job", newJob)
        window.addJob(newJob)
    }
}

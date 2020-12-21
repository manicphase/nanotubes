# PeerTube Nano plugin

This plugin integrates a nano wallet into peertube instance websites. This plugin uses the nanocurrency-web and nanowebgl node modules. Proof of work is done on the client side. Network data is passed through a reverse proxy which contacts a nano node RPC interface and is packaged into the plugin. Everything is designed to be as simple as possible.

All instance admins have to do is install the plugin and it's all already set up and ready to go.

Viewers will have a wallet automatically created on first accessing the website. Funds can be added using the address/qr code created. Wallets are stored using localStorage and are not tied to user accounts. Donations are automatically sent directly to creators. THIS IS AN EARLY PROOF OF CONCEPT. DO NOT ADD MORE THAN A COUPLE OF DOLLARS WORTH OF NANO, YOU MAY LOSE IT DUE TO BUGS OR SECURITY FLAWS. I AM NOT RESPONSIBLE FOR ANY LOSSES YOU MAY INCUR.

Creators can add a nano address to the support section on videos to allow receiving automatic donations.


This plugin is an a work in progress which has so far reached the point of everything just about working. There's still a lot to do to make it polished including.

-Refactor the code (maybe create a seperate simple wallet module)
-Less verbose log output to console
-Fix timing issues which sometimes prevent plugin from launching
-Make plugin match look and feel of peertube
-Add alternative methods to create proof of work
-Use websockets instead of polling to update wallet data
-Security audit?
### Synthona ~ Associative Information System

need to write something more comprehensive here eventually, but for now here is how to set up for development...

1) clone the synthona-electron github repository
2) run npm install in the root directory
3) cd into src/server and run npm install there as well
4) cd back up to the root directory
5) npm start

From here, you should be able to make changes to the server if you're experimenting there. You will have to restart the server for the changes to take effect. If you're wanting to make changes to the user interface, you will need to download the synthona-react-client repository and make changes to that.

If you're interested in experimenting with the frontend-interface (synthona-react-client) you'll need to edit the synthona configuration file and point the CLIENT_PORT value to match whatever port synthona-react-client is running on (i believe it should be 3000 by default)

Once you have an updated build of the synthona-react-client ready to incorporate into synthona-electron, you will have to run npm run-script build in order to generate a new client build, and then copy those files into synthona-electron/src/client/ where you should overwrite all existing files. Typically when I am updating the client build like this i delete everything out of synthona-electron/src/client/ so it's empty, and then paste the newly built files from synthona-react-client into there


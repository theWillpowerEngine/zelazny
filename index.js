var CLA = require('nw.gui').App.argv

if(CLA.indexOf("-edit") >= 0)
    nw.Window.open('editor.htm', {
        width: 1200,
        height: 700
    }, function(win) {})
else 
    nw.Window.open('nw-index.htm', {
        width: 1200,
        height: 700
    }, function(win) {})
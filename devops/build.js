var NwBuilder = require('nw-builder');
var nw = new NwBuilder({
  files: ['./**', '!./build/**'],
  platforms: ['win64'],   //'osx64' 'win32'
  cacheDir: './nwjs/cache',
  zip: false,
  winIco: "./twe.ico"
});

nw.on('log',  console.log);
nw.build(function(err) {
  if(err) return console.error(err);
  console.log('all done!');
});
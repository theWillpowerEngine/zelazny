if(!module || !module.exports)
    var module = {exports: [] }

var providers = {
    name: 'template',

    webJqGet: "wjqget",
    fsedit: "fsedit"
}

var provider = module.exports = {
    current: {
        load(name, cb) {
            var fs = require('fs')
            fs.readFile(`./nodes/${(provider.chapter ? provider.chapter + "/" : "") + name}`, function (err, data) {
                if (err) {
                  provider.error(err)
                  return
                }
                provider.node = name
                cb(data.toString())
            });
        }
    },
    error: (err) => {
        console.error(err)
        throw err
    },

    chapter: null,
    node: null,

    load(node, chapter, cb) {
        if(chapter)
            provider.chapter = chapter
        provider.current.load(node, cb)
    },

    save(node, chapter, content, cb) {
        if(!provider.current.save)
            throw "Save not implemented for current provider"

        if(chapter)
            provider.chapter = chapter
        provider.current.save(node, content, cb)
    },

    setProvider(name) {
        if(!(provider.current = provider._provs[name]))
            throw "Provider " + name + " not found"
    },

    _provs: {
        wjqget: {
            load(name, cb) {
                $.ajax({
                    url: `./nodes/${(provider.chapter ? provider.chapter + "/" : "") + name}`,
                    success: cb,
                    dataType: 'text'
                });
            }
        },

        fsedit: {
            load(name, cb) {
                var fs = require('fs')
                var fname = `./nodes/${(provider.chapter ? provider.chapter + "/" : "") + name}`
                if(!fs.existsSync(fname))
                    fs.writeFileSync(fname, "New Node")
                fs.readFile(fname, function (err, data) {
                    if (err) {
                        provider.error(err)
                        return
                    }
                    provider.node = name
                    cb(data.toString())
                });
            },
            save(name, content, cb) {
                var fs = require('fs')
                var fname = `./nodes/${(provider.chapter ? provider.chapter + "/" : "") + name}`
                fs.writeFileSync(fname, content)
                if(cb) cb()
            }
        },

        template: {
            load(name, cb) {
                //load your stuff here and pass it to cb instead of name
                cb(name)
            }
        }
    }
}
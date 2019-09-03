window["zel"] = null

function setGlobalZelazny(s, z) {
    if(!s) throw "You must pass either a navigate lambda or a state to setGlobalZelazny"

    if(!s.navigate && typeof(s) == "function") {    //s is navigate
        if(!z && !zelazny)  throw "Zelazny must be defined globally or passed in to setGlobalZelazny"
        var opts = {
            navigate: s,
            xpPerLevel: 1,
            lives: 1,
            boons: 1
          }
          window.zel = {
            state: state.create(opts),
            zelazny: z ? z : zelazny
        }
    } else {    //s is state
        window.zel = {
            state: s,
            zelazny: z
        }
    }
}

jQuery.fn.extend({
    zelazny: function(st, engine) {
        if(!st)  st = zel.state
        if(!engine)  engine = zel.zelazny
        if(!engine || !st) throw "Globals were not set and no state and engine passed to zelazny.  Call setGlobalZelazny"
        
        var $div = this;
        var content = replaceAll($div.text(), /\\/g, "")

        var render = isRe => {
            if(!isRe)
                $div.html(engine.parse(st, content))
            else
                $div.html(engine.parseAndSkipCommands(st, content))
        
            $div.children(".action-link").off('click').click(e => {
                var $e = $(e.target)
                var cmd = $e.next().text()
        
                zelazny.parse(st, "{" + cmd + "}")
                render(true)
            })
        }
        
        render()
        return this
    }
})

$(() => {
    $(".zelazny").zelazny()
})
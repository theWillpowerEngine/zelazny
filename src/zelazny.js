if(!module || !module.exports)
    var module = {exports: [] }

const gs = (typeof require == "function") ? require('./state') : state;

function replaceAll(target, search, replacement) {
    return target.replace(new RegExp(search, 'g'), replacement)
}
function toScope(name) {
    switch(name.toLowerCase()) {
        case "player":
        case "pc":
        case "you":
            return 'pc'

        case "here":
        case "node":
            return 'node'

        case 'story':
        case "section":
        case "chapter":
            return 'story'

        case 'it':
        case "this":
            return 'def'

        default:
            throw "Unknown scope level: " + name
    }
}


var zelazny = module.exports = {
    isNavigating: 'NAVIGATING',
    registerMacro(name, fn) {
        if(zelazny._guts.macros.find(m => m.name == name))
            throw "Duplicate macro name: " + name
    
        zelazny._guts.macros.push({name: name, eval: fn})
    },
    
    //Basic, run of the mill, "parse this Zelazny string"
    parse(state) {
        var output = '';

        for(var i in arguments) {
            var code = arguments[i]
            var scanned = zelazny._guts.scan(state, code)
            output += zelazny._guts.evaluate(state, scanned)
        }

        return output
    },

    //Parse a Zelazny string without evaluating any commands
    parseAndSkipCommands(state) {
        var output = '';

        for(var i in arguments) {
            var code = arguments[i]
            var scanned = zelazny._guts.scan(state, code)
            output += zelazny._guts.evaluate(state, scanned, true)
        }

        return output
    },

    _guts: {
        macros: [],

        //Scanner - turn a Zelazny string into a beautiful(ish) tree-like structure
        scan(state, code) {
            if(!code)
                return [];

            var eles = [];
            var layerState = {
                star: false,
                us: false,
                slash: false
            }

            var i =0;
            var work = '';

            var scanTo = (start, end) => {
                var skip = 1;
                var ret = '';
                while(code[i] != end || skip > 0) {
                    if(++i == code.length)
                        throw "Missing " + end + " before end of code"
                    
                    ret += code[i]

                    if(code[i] == start)
                        skip += 1
                    if(code[i] == end)
                        skip -= 1
                }

                return ret.substr(0,ret.length-1)
            }
            var existsAtRoot = (check, start, end, c) => {
                var skip = 0;
                var ii = 0;
                while(check[ii] != c || skip > 0) {
                    if(check[ii] == start)
                        skip += 1
                    if(check[ii] == end)
                        skip -= 1

                    if(++ii == check.length)
                        return -1;
                }

                return ii;
            }
            var expected = (str, dec) => {
                idx = 0;
                while(true) {
                    if(++i == code.length)
                        throw "Expected " + str + " before end of code"
                    
                    var c = code[i]
                    if(idx == 0) {
                        if(c == ' ' || c == '\t' || c == '\r' || c=='\n')
                            continue
                    }
                    if(c == str[idx++]) {
                        if(idx == str.length) {
                            if(dec) i -= 1
                            return true
                        } else 
                            continue
                    }

                    return false
                }
            }

            var addWork = (eatWS) => {
                if(work) {
                    //if(!eatWS && work.endsWith(' '))
                        //work = work.substr(0, work.length-1) + "&nbsp;"
                    eles.push(work)
                    work = ''
                }
            }

            for(i=0; i<code.length; i++) {
                var c = code[i];
                switch(c) {

                //Merge Tags
                case '[':
                    addWork(true)
                    var tag = scanTo('[', ']')
                    eles = eles.concat(zelazny._guts.scanMerge(state, tag, existsAtRoot))
                    break

                case ']':
                    throw "Too many ]'s, at '" + code.substr(0, i) + "'";

                //Command tags
                case '{':
                    addWork(true)
                    var tag = scanTo('{', '}')
                    eles = eles.concat(zelazny._guts.scanCommands(tag))
                    break

                case '}':
                    throw "Too many }'s, at '" + code.substr(0, i) + "'";

                //Custom Macros
                case '^':
                    addWork(true)
                    var body = scanTo('^~^~^', '~')        //never nested so no need to get fancy
                    var macro = body.split(' ')[0];
                    body = body.substr(macro.length).trimLeft()
                    var macroOb = zelazny._guts.macros.find(m => m.name == macro)
                    if(!macroOb)
                        throw "Custom macro '" + macro + "' was not found"
                    eles = eles.concat(zelazny._guts.scan(state, macroOb.eval(zelazny, state, body)))
                    break

                case '~':
                    throw "Too many ~'s, at '" + code.substr(0, i) + "'";

                //links
                case '`':
                    addWork()
                    var linkText = scanTo('\0', '`')
                    if(!expected('=>'))
                        throw("Link must have destination: " + linkText)
                    if(!expected('{'))
                        throw("Link must be followed by command tag: " + linkText)

                    var ct = scanTo('{', '}')

                    //boon link
                    var isBoon = false, isBotch = false
                    if(isBoon = linkText.startsWith('$')) 
                        linkText = linkText.substr(1)
                    if(isBotch = linkText.startsWith('!')) 
                        linkText = linkText.substr(1)

                    eles.push({
                        cmd: 'link',
                        text: linkText,
                        botch: isBotch,
                        boon: isBoon,
                        arg: replaceAll(ct, '\r', '')
                    })
                    break

                //Formatting
                case '*':
                    work += (layerState.star ? "</b>" : "<b>")
                    layerState.star = !layerState.star
                    break
                case '_':
                    work += (layerState.us ? "</u>" : "<u>")
                    layerState.us = !layerState.us
                    break
                case '\\':
                    work += (layerState.slash ? "</i>" : "<i>")
                    layerState.slash = !layerState.slash
                    break
                
                case '\n':
                    try {    
                        if(code[i+1] == '\n' || code[i+1] == '\r')   {
                            i += 1
                            work += "<br /><br />"
                        }
                    } catch(e){}
                    break

                case '\r':
                    break

                case ' ':
                case '\t':
                    if(work.endsWith(' '))
                        work = work.substr(0,work.length-1) + "&nbsp; "
                    else if(work.endsWith('>') && !(work.endsWith("/b>") || work.endsWith("/i>") || work.endsWith("/u>") || work.endsWith("/div>"))) {}
                    else
                        work += ' '
                    break

                default:
                    work += c
                    break
                }

            }
            addWork();
            return eles;
        },

        //This is a sub-scanner than turns merge tags (the stuff in square brackets) into tree branches and leaves
        scanMerge(state, tag, existsAtRoot) {
            var eles = []
            var cmd = tag[0], sub = ''
            var rest = tag.substr(1).trimLeft();
            var yes = '', no = '';

            switch(cmd) {
                //<cmd> <param>[|<param>]
                case '?':
                case '!':
                    sub = rest.split(' ')[0];
                    rest = rest.substr(sub.length).trimLeft()

                    var pos = existsAtRoot(rest, '[', ']', '|')
                    if(pos >= 0) {
                        yes = zelazny._guts.scan(state, rest.substr(0, pos).trimLeft())
                        no = zelazny._guts.scan(state, rest.substr(pos+1).trimLeft())
                    } else
                        yes = zelazny._guts.scan(state, rest)

                    eles.push({
                        cmd: cmd,
                        flag: sub,
                        yes: yes,
                        no: no
                    })
                    break

                //<compound-op><cmd>:<cmd>... <text>
                case '&':
                case '|':
                    sub = rest.split(' ')[0];   //sub is condition-block
                    rest = rest.substr(sub.length).trimLeft()
                    
                    var condTexts = sub.split(',')
                    var conds = []
                    for(var ci in condTexts) {
                        var cond = condTexts[ci]
                        var toke = zelazny._guts.scanMerge(state, cond + " 1", existsAtRoot)[0]
                        conds.push(toke)
                    }
                    
                    var pos = existsAtRoot(rest, '[', ']', '|')
                    if(pos >= 0) {
                        yes = zelazny._guts.scan(state, rest.substr(0, pos).trimLeft())
                        no = zelazny._guts.scan(state, rest.substr(pos+1).trimLeft())
                    } else
                        yes = zelazny._guts.scan(state, rest)

                    eles.push({
                        cmd: cmd,
                        conds: conds,
                        yes: yes,
                        no: no
                    })
                    break

                //:<trait> <val>:<text>[|...][|<text>]
                case ':':
                    sub = rest.split(' ')[0];   //sub is trait
                    rest = rest.substr(sub.length).trimLeft()
                    var rangeLines = rest.split('|')
                    var range = []
                    var defEle = null
                    for(var ri in rangeLines) {
                        var rl = rangeLines[ri]
                        if(rl) {
                            var reles = rl.split(':')
                            if(reles.length > 2)
                                throw "Too many parts to range-element: " + rl
                            
                            if(reles.length == 1) {
                                if(defEle)
                                    throw "Default result already set for range, cannot set again.  Second one was: " + rl
                                defEle = zelazny._guts.scan(state, reles[0].trimLeft())
                            } else {
                                for(var stinkfist in range)
                                    if(range[stinkfist].value == reles[0])
                                        throw "Duplicate value in range: " + reles[0]
                                range.push({
                                    value: reles[0],
                                    tokes: zelazny._guts.scan(state, reles[1].trimLeft())
                                })
                            }
                        }
                    }
                    range.sort(function(a, b){
                        if(!isNaN(a.value) && !isNaN(b.value))
                            return a.value-b.value
                        else
                            return (a.value>b.value) ? 1 : ((a.value==b.value) ? 0 : -1)
                    })
                    eles.push({
                        cmd: "range",
                        flag: sub,
                        range: range,
                        default: defEle
                    })
                    break

                //<cmd>:arg <param>[|<param>]
                case '>':
                case '<':
                case '=':
                    sub = rest.split(' ')[0];
                    rest = rest.substr(sub.length).trimLeft()

                    var pos = existsAtRoot(rest, '[', ']', '|')
                    if(pos >= 0) {
                        yes = zelazny._guts.scan(state, rest.substr(0, pos).trimLeft())
                        no = zelazny._guts.scan(state, rest.substr(pos+1).trimLeft())
                    } else
                        yes = zelazny._guts.scan(state, rest)

                    var split = sub.split(':')
                    if(split.length != 2)
                        throw "Invalid value for GT/LT";

                    eles.push({
                        cmd: cmd,
                        flag: split[0],
                        arg: parseInt(split[1]),
                        yes: yes,
                        no: no
                    })
                    break
            
                case '1':
                    eles.push({
                        cmd: 'first',
                        eles: zelazny._guts.scan(state, rest.trim())
                    })
                    break;

                case '"':
                    sub = rest.split(' ')[0].toLowerCase();
                    rest = rest.substr(sub.length).trimLeft()
                    var branch = zelazny._guts.scan(state, "[?topic_" + sub + " " + rest + "{is not topic_" + sub + "}]")
                    branch[0].dlg = true
                    eles = eles.concat(branch)
                    break

                case '@':
                    eles = eles.concat(zelazny._guts.scan(state, "[!once_only " + rest + "{is once_only}]"))
                    break

                default:
                    throw "Unknown merge command: " + cmd
            }

            return eles
        },

        //This is a sub-scanner than turns command blocks (the stuff in curly-braces) into tree branches and leaves
        scanCommands(code) {
            var lines = replaceAll(code, '\r', '').split('\n')
            var ret = [];
            for(var i in lines) {
                var line = lines[i].trim()
                if(!line)
                    continue

                var words = replaceAll(line, "  ", " ").split(' ')
                //{is [not] <flag>}
                if(words[0] == 'is' || words[0] == 'are' || words[0] == 'has') {
                    var not = (words[1] == 'not')
                    var flag = not ? words[2] : words[1]
                    ret.push({
                        cmd: not ? 'clear' : 'set',
                        flag: flag,
                        scope: 'def'
                    })

                //{<scope> is [not] <flag>}
                } else if(words[1] == 'is' || words[1] == 'are' || words[1] == 'has') {
                    var not = (words[2] == 'not')
                    var flag = not ? words[3] : words[2]
                    var scope = toScope(words[0])
                    ret.push({
                        cmd: not ? 'clear' : 'set',
                        flag: flag,
                        scope: scope
                    })

                //go to <name>
                } else if(words[0] == 'go' && words[1] == 'to') {
                    var node = words[2]
                    ret.push({
                        cmd: 'nav',
                        arg: node
                    })

                //start <story> and go to <name>
                } else if(words[0] == 'start' && words[2] == 'and' && words[3] == 'go' && words[4] == 'to') {
                    var node = words[5]
                    var story = words[1]
                    ret.push({
                        cmd: 'nav',
                        arg: node,
                        story: story
                    })

                //can be <flag>[[,] [or|and] <flag>]...
                } else if(words[0] == 'can' && words[1] == 'be') {
                    var s = ''
                    for(var i=2; i<words.length; i++)
                    {
                        var word = words[i];
                        if(word == "or" || word == 'and')
                            continue

                        s += word.replace(',', '') + ":"
                    }
                    ret.push({
                        cmd: 'enum',
                        flag: s.substr(0,s.length-1),
                        scope: 'def'
                    })

                //<scope> can be <flag>[[,] [or|and] <flag>]...
                } else if(words[1] == 'can' && words[2] == 'be') {
                    var s = ''
                    var scope = toScope(words[0])
                    for(var i=3; i<words.length; i++)
                    {
                        var word = words[i];
                        if(word == "or" || word == 'and')
                            continue

                        s += word.replace(',', '') + ":"
                    }
                    ret.push({
                        cmd: 'enum',
                        flag: s.substr(0,s.length-1),
                        scope: scope
                    })

                //can have <flag> from <low> to <high>
                } else if(words[0] == 'can' && words[1] == 'have') {
                    var flag = words[2]
                    var idx = 3;

                    if(words[idx] == "from") idx += 1
                    var low = parseInt(words[idx++])
                    if(words[idx] == "to") idx += 1
                    var high = parseInt(words[idx])

                    if(low >= high)
                        throw "A trait must have its lower bound below its higher bound"

                    ret.push({
                        cmd: 'trait',
                        flag: flag,
                        scope: 'def',
                        low: low,
                        high: high
                    })

                //<scope> can have <flag> from <low> to <high>
                } else if(words[1] == 'can' && words[2] == 'have') {
                    var flag = words[3]
                    var idx = 4;
                    var scope = toScope(words[0])

                    if(words[idx] == "from") idx += 1
                    var low = parseInt(words[idx++])
                    if(words[idx] == "to") idx += 1
                    var high = parseInt(words[idx])

                    if(low >= high)
                        throw "A trait must have its lower bound below its higher bound"

                    ret.push({
                        cmd: 'trait',
                        flag: flag,
                        scope: scope,
                        low: low,
                        high: high
                    })

                //inc|dec <trait> [by <#>]
                } else if(words[0] == 'increment' || words[0] == 'decrement' || words[0] == 'inc' || words[0] == 'dec' ) {
                    var flag = words[1]
                    var amt = 1

                    if(words.length == 4 && words[2] == 'by') {
                        amt = parseInt(words[3])
                        if(!amt)
                            throw "Invalid number " + words[3] + " passed to inc/dec by command"
                    }
                    
                    ret.push({
                        cmd: words[0].substr(0, 3),
                        flag: flag,
                        amt: amt
                    })                

                //set <trait> to <#>
                } else if(words[0] == 'set' && words[2] == 'to') {
                    var trait = words[1]
                    var val = parseInt(words[3])
                    
                    ret.push({
                        cmd: 'findAndSet',
                        flag: trait,
                        val: val
                    })
                
                //add <#> xp to <trait>
                } else if(words[0] == 'add' && words[2] == 'xp' && words[3] == "to") {
                    var trait = words[4]
                    var xp = parseInt(words[1])
                    if(!xp)
                        throw "Cannot add no xp"
                    
                    ret.push({
                        cmd: 'xp',
                        flag: trait,
                        val: xp
                    })               
            
                //<node type> node
                } else if(words[1] == 'node') {
                    var nt = words[0].toLowerCase()
                    switch(nt) {
                    case "dialogue":
                        ret.push({
                            cmd: 'dialogueNode'
                        })
                        break

                    case "room":
                        ret.push({
                            cmd: 'roomNode'
                        })
                        break

                    default:
                        throw "Unknown node type: " + nt
                    }

                //topic <topic>
                } else if(words[0] == "topic") {
                    ret.push({
                        cmd: "topic",
                        topic: words[1].toLowerCase()
                    })

                //name <...>
                } else if(words[0] == "name") {
                    ret.push({
                        cmd: "roomName",
                        name: line.trim().substr(5).trim()
                    })

                } else if(words[0] == "log") {
                    ret.push({
                        cmd: "log",
                        text: line.trim().substr(4).trim()
                    })
                   
                //note ....
                } else if(words[0] == 'note') {
                    //Nothing to do, just skip the line.

                } else 
                    throw "Unknown command, " + line
            }

            return ret
        },

        //Parser.  Turn our tree into HTML with some Commands hidden in it
        evaluate(state, tokes, skip) {
            var html = '';

            for(var i in tokes) {
                var toke = tokes[i];

                if(!toke.cmd)
                    html += toke;
                else {
                    switch(toke.cmd) {
                    case '?':
                        if(state.hasFlag(toke.flag)) {
                            var res = zelazny._guts.evaluate(state, toke.yes)
                            html += res
                            if(toke.dlg && state.specialLog)
                                state.specialLog(res)
                        } else {
                            var res = zelazny._guts.evaluate(state, toke.no)
                            html += res
                            if(res && toke.dlg && state.specialLog)
                                state.specialLog(res)
                        }
                        break
                    case '!':
                        if(state.hasFlag(toke.flag))
                            html += zelazny._guts.evaluate(state, toke.no)
                        else {
                            var res = zelazny._guts.evaluate(state, toke.yes)
                            if(toke.flag == "once_only" && state.specialLog)
                                state.specialLog(res)
                            html += res
                        }break

                    case '>':
                        if(state.hasFlag(toke.flag, toke.arg))
                            html += zelazny._guts.evaluate(state, toke.yes)
                        else
                            html += zelazny._guts.evaluate(state, toke.no)
                        break
                    case '<':
                        if(!state.hasFlag(toke.flag) || state.hasFlag(toke.flag, toke.arg+1))
                            html += zelazny._guts.evaluate(state, toke.no)
                        else
                            html += zelazny._guts.evaluate(state, toke.yes)
                        break
                    case '=':
                        if(state.hasFlagExact(toke.flag, toke.arg))
                            html += zelazny._guts.evaluate(state, toke.yes)
                        else
                            html += zelazny._guts.evaluate(state, toke.no)
                        break
                        
                    case '&':
                        if(zelazny._guts.evaluate(state, toke.conds).length == toke.conds.length)
                            html += zelazny._guts.evaluate(state, toke.yes)
                        else
                            html += zelazny._guts.evaluate(state, toke.no)
                        break
                    case '|':
                        if(zelazny._guts.evaluate(state, toke.conds).length >= 1)
                            html += zelazny._guts.evaluate(state, toke.yes)
                        else
                            html += zelazny._guts.evaluate(state, toke.no)
                        break

                    case "first":
                        for(var i in toke.eles) {
                            var ele = toke.eles[i]
                            var res = zelazny._guts.evaluate(state, [ele])
                            if(res) {
                                html += res;
                                break
                            }
                        }
                        break
                                
                    case 'range':
                        var tval = Math.floor(state.getFlagValue(toke.flag))
                        var didSomething = false
                        for(var ri in toke.range) {
                            var re = toke.range[ri]
                            var cval = re.value

                            if(tval <= cval) {
                                html += zelazny._guts.evaluate(state, re.tokes)
                                didSomething = true
                                break
                            }
                        }
                        if(!didSomething) {
                            html += zelazny._guts.evaluate(state, toke.default)
                        }
                        break

                    case "link":
                        if(toke.boon && state.boons > 0)
                            html += "<a class='boon-link'>" + zelazny.parse(state, toke.text) + "</a><div class='code' style='display:none'>" + toke.arg + "</div>"
                        else if(toke.botch && state.lives > 0)
                            html += "<a class='botch-link'>" + zelazny.parse(state, toke.text) + "</a><div class='code' style='display:none'>" + toke.arg + "</div>"
                        else if(!toke.boon && !toke.botch)
                            html += "<a class='action-link'>" + zelazny.parse(state, toke.text) + "</a><div class='code' style='display:none'>" + toke.arg + "</div>"
                        else
                            html += ''
                        break

                    case "set":
                        if(skip) break;
                        state.setFlag(toke.flag, toke.scope, toke.val ? toke.val : 1)
                        break
                    case "findAndSet":
                        if(skip) break;
                        state.setFlag(toke.flag, state.getFlagScope(toke.flag), toke.val)
                        break

                    case "dialogueNode":
                        state.inDialogueMode = true
                        break

                    case "roomNode":
                        state.isRoom = true
                        break

                    case "clear":
                        if(skip) break;
                        state.setFlag(toke.flag, toke.scope)
                        break

                    case "enum":
                        if(skip) break;
                        var enumFlag = gs.bundleFlags(toke.flag)
                        state.createEnum(enumFlag[0], toke.scope)
                        break

                    case "trait":
                        if(skip) break;
                        state.createTrait(toke.flag, toke.low, toke.high, toke.low, toke.scope)
                        break
                    case "inc":
                        if(skip) break;
                        state.setFlag(toke.flag, state.getFlagScope(toke.flag), state.getFlagValue(toke.flag) + toke.amt)
                        break
                    case "dec":
                        if(skip) break;
                        state.setFlag(toke.flag, state.getFlagScope(toke.flag), state.getFlagValue(toke.flag) - toke.amt)
                        break
                    case "xp":
                        if(skip) break;
                        state.addXP(toke.flag, toke.val)
                        break

                    case "topic":
                        if(!state.inDialogueMode)
                            throw "Cannot evaluate topic command when not in dialogue mode"
                    
                        state.setFlag("topic_" + toke.topic, "node", 1)
                        state.setFlag(toke.topic, "node", 1)
                        break

                    case "roomName":
                        if(!state.isRoom)
                            throw "Can't set room name if we're not in a room node (duh)"
                    
                        state.roomName = toke.name
                        break

                    case "log":
                        if(!state.specialLog)
                            throw "Special Log method not set by client, but log called in Zelazny"
                        state.specialLog(zelazny.parseAndSkipCommands(state, toke.text))
                        break
        
                    case "nav":
                        if(skip) break;
                        if(state.preNavigate)
                            state.preNavigate(toke.arg, toke.story)
                        state.setNode(toke.arg)
                        if(toke.story)
                            state.setStory(toke.story)
                        
                        state.navigate(toke.arg, toke.story)
                        return "NAVIGATING"
                    }
                }
            }
            return html
        }
    }
}
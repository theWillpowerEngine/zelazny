if(!module || !module.exports)
    var module = {exports: [] }

var state = module.exports = {
    load(opts, bundle) {
        var retVal = state.create(opts)
        retVal.flags = bundle.flags
        retVal.xp = bundle.xp
        retVal.lives = bundle.lives
        retVal.boons = bundle.boons
        retVal.inDialogueMode = bundle.dlg
        retVal.isRoom = bundle.rm
        retVal.roomName = bundle.rn
        return retVal
    },

    create(opts) {
        if(!opts)
            throw "You must supply options to create a state"
        
        if(!opts.navigate)
            throw "Navigation callback required for state create"
        
        if(!opts.playerFlags)
            opts.playerFlags = []
        if(!opts.nodeFlags)
            opts.nodeFlags = []
        if(!opts.storyFlags)
            opts.storyFlags = []
        if(!opts.xpPerLevel)
            opts.xpPerLevel = 10
        if(!opts.lives)
            opts.lives = 0
        if(!opts.boons)
            opts.boons = 0
            
        var innermostThis = {
            navigate: opts.navigate,
            preNavigate: opts.preNavigate,
            specialLog: opts.specialLog,
            
            inDialogueMode: false,
            isRoom: false,
            roomName: "",
            
            xp: opts.xpPerLevel,
            lives: opts.lives,
            boons: opts.boons,

            flags : {
                pc: opts.playerFlags,
                node: opts.nodeFlags,
                story: opts.storyFlags
            },

            toSaveBundle() {
                return {
                    flags: innermostThis.flags,
                    xp: innermostThis.xp,
                    boons: innermostThis.boons,
                    lives: innermostThis.lives,
                    dlg: innermostThis.inDialogueMode,
                    rm: innermostThis.isRoom,
                    rn: innermostThis.roomName
                }
            },

            setStory(story) {
                innermostThis.flags.story = []
                innermostThis.inDialogueMode = false
                innermostThis.isRoom = false
                innermostThis.roomName = ''
            },
            setNode(node) {
                innermostThis.flags.node = []
                innermostThis.inDialogueMode = false
                innermostThis.isRoom = false
                innermostThis.roomName = ''
            },

            addXP(trait, xp) {
                for(var i in innermostThis.flags.pc)
                {
                    var flag = innermostThis.flags.pc[i]
        
                     if(!flag.xp && flag.level > 0)
                         flag.xp = ((flag.level-1) * innermostThis.xp)+1   //Seed xp for explicitly set traits
                    
                    if(flag.flag == trait) {
                        if(!flag.xp) flag.xp = 0
                        flag.xp += xp
                        
                        var lv = 0;
                        lv = (flag.xp / innermostThis.xp) + 1
                        
                        innermostThis.setFlag(trait, 'pc', lv)
                        return
                    }
                }

                throw "Cannot add xp to trait, not found: " + trait
            },

            getFlagValue(name) {
                return innermostThis.getFlag(name).level
            },
            getFlag(name) {
                for(var i in innermostThis.flags.pc)
                {
                    var flag = innermostThis.flags.pc[i]
        
                    if(flag.flag == name)
                        return flag
                }
                for(var i in innermostThis.flags.story)
                {
                    var flag = innermostThis.flags.story[i]
        
                    if(flag.flag == name)
                        return flag
                }
                for(var i in innermostThis.flags.node)
                {
                    var flag = innermostThis.flags.node[i]
        
                    if(flag.flag == name)
                        return flag
                }
                
                throw "Cannot get flag " + name
            },
            getFlagScope(name) {
                for(var i in innermostThis.flags.pc)
                {
                    var flag = innermostThis.flags.pc[i]
        
                    if(flag.flag == name)
                        return "pc"
                }
                for(var i in innermostThis.flags.story)
                {
                    var flag = innermostThis.flags.story[i]
        
                    if(flag.flag == name)
                        return "story"
                }
                for(var i in innermostThis.flags.node)
                {
                    var flag = innermostThis.flags.node[i]
        
                    if(flag.flag == name)
                        return "node"
                }
                
                throw "Cannot get scope for flag " + name
            },
            hasFlag(name, level) {
                if(!level && level !== 0)
                    level = 1

                return state.hasFlagIn(innermostThis.flags.pc, name, level) || 
                        state.hasFlagIn(innermostThis.flags.story, name, level) ||
                        state.hasFlagIn(innermostThis.flags.node, name, level)
            },
            hasFlagExact(name, level) {
                if(!level && level !== 0)
                    level = 1

                return state.hasFlagIn(innermostThis.flags.pc, name, level, true) || 
                        state.hasFlagIn(innermostThis.flags.story, name, level, true) ||
                        state.hasFlagIn(innermostThis.flags.node, name, level, true)
            },

            setFlag(flag, scope, val) {
                if(scope == "def")
                    scope = "node"

                var work

                if(work = state.getFlagWithEnumValue(innermostThis, flag)) {
                    work.flag = flag

                } else if(state.hasFlagIn(innermostThis.flags[scope], flag, -9999)) {
                    if(!val && val !== 0)
                        innermostThis.flags[scope].splice(innermostThis.flags[scope].findIndex(e => e.flag == flag), 1)
                    else {
                        var idx = innermostThis.flags[scope].findIndex(e => e.flag == flag)
                        if(innermostThis.flags[scope][idx].low || innermostThis.flags[scope].high) {
                            val = parseInt(val)
                            if(val < innermostThis.flags[scope][idx].low)
                                val = innermostThis.flags[scope][idx].low
                            if(val > innermostThis.flags[scope][idx].high)
                            val = innermostThis.flags[scope][idx].high
                        }
                        innermostThis.flags[scope][idx].level = val
                    }
                
                } else {
                    if(!val)
                        return;
                    else {
                        //If we are creating a flag for the first time, verify there is no enum clash
                        if(state.getFlagWithEnumValue(innermostThis, flag))
                            throw "Cannot add flag '" + flag + "', would clash with possible enumeration value"
                        innermostThis.flags[scope] = innermostThis.flags[scope].concat(state.bundleFlags(flag))
                    }
                }
            },

            createEnum(enumFlag, scope) {
                for(var i in enumFlag.enum) {
                    var ev = enumFlag.enum[i]

                    if(innermostThis.hasFlag(ev))
                        throw "Cannot create enum value '" + ev + "', would be duplicate of existing flag"
                }

                if(scope == "def")
                    scope = "node"

                innermostThis.flags[scope].push(enumFlag)
            },
            createTrait(name, low, high, val, scope) {
                if(innermostThis.hasFlag(name))
                    throw "Cannot create trait '" + name + "', would replace an existing flag"
                
                if(scope == "def")
                    scope = "node"

                innermostThis.flags[scope].push({flag: name, level: val, low: low, high: high})
            }
        }

        return innermostThis;
    },

    bundleFlags() {
        var retVal = [];
        
        for(var i in arguments) {
            var arg = arguments[i]
            var last = arg[arg.length - 1]
            if (!isNaN((last = parseInt(last, 10))))
                retVal.push({flag: arg.substr(0, arg.length-1), level: last})
            else if(arg.indexOf(":") > 0) {
                var enums = arg.split(':')
                retVal.push({flag: enums[0], enum: enums, level: 1})
            } else
                retVal.push({flag: arg, level: 1})
        }

        return retVal;
    },
    hasFlagIn(a, name, level, exact) {
        for(var i in a)
        {
            var flag = a[i]

            if(flag.flag == name)
                return exact ? Math.floor(flag.level) == level : Math.floor(flag.level) >= level
        }

        return false
    },

    getFlagWithEnumValue(state, val) {
        for(var i in state.flags.node)
        {
            var flag = state.flags.node[i]

            if(flag.enum && flag.enum.length && flag.enum.indexOf(val) > -1)
                return flag
        }

        for(var i in state.flags.story)
        {
            var flag = state.flags.story[i]

            if(flag.enum && flag.enum.length && flag.enum.indexOf(flag) > -1)
                return flag
        }

        for(var i in state.flags.pc)
        {
            var flag = state.flags.pc[i]

            if(flag.enum && flag.enum.length && flag.enum.indexOf(flag) > -1)
                return flag
        }

        return null
    }
}
var z = require("../src/zelazny.js")
var gs = require("../src/state.js")

var assert = require("assert")

var opts = {navigate: dest => {} }

var emptyState = gs.create(opts)
var pn = (c) => z.parse(emptyState, c)
var pnws = (s, c) => z.parse(s, c)
var testState = gs.create({navigate: dest => {}, playerFlags: gs.bundleFlags('pf', 'pt3'), nodeFlags: gs.bundleFlags('nf', 'nt2'), storyFlags: gs.bundleFlags('sf') })
var pnt = (c) => z.parse(testState, c)

function testSimple() {
    try {
        assert.throws(() => { gs.create() }, "Create requires options")
        assert.throws(() => { gs.create({ blah: "blah"}) }, "Create requires navigate")
        
        assert.equal(0, pn().length, "empty code fails")

        assert.doesNotThrow(() => {pn("{note comments work!  woo hoo}")}, "comments")
        assert.throws(() => {pn("{nooxe comments work!  woo hoo}")}, "bad keywords")

        assert.throws(() => {pn("{log this shouldn't work}")}, "Can't log if special logger not set")

        assert.equal("1<br /><br />2", pn("1\r\n\r\n2"), "newlines to breaks")
        assert.equal("1&nbsp; 2", pn("1  2"), "non-breaking-spaces as needed to preserve formatting")
        assert.equal("1&nbsp;&nbsp;&nbsp; 2", pn("1    2"), "non-breaking-spaces as needed to preserve formatting 2")
        
        //Basic formatting tests
        assert.equal("<i>h</i>", pn("\\h\\"), "Italics doesn't work")
        assert.equal("<b>h</b>", pn("*h*"), "Bold doesn't work")
        assert.equal("<u>h</u>", pn("_h_"), "Underscore doesn't work")
    
        //Nesting
        assert.equal("Hello <i><b>fucking</b> nurse</i>", pn("Hello \\*fucking* nurse\\"), "Simple nested formatter test failed")

        //Fucking bullshit fuckety fuck fuck
        pn("{it is picked}")
        assert.equal("T", pn("[!picked F|T]"), "bugfix 1")
        assert.equal("12&nbsp; ", pn("[?picked 12  ]"), "embedded spaces")
        assert.equal("12&nbsp; ", pn("[?picked 12  | 34  ]"), "embedded spaces 2")

        pn("{it can have thingy from 0 to 5}")
        assert.equal("T", pn("[?thingy F|T]"), "numbers as bools 1")
        assert.equal("T", pn("[!thingy T|F]"), "numbers as bools 2")
        pn("{set thingy to 1}")
        assert.equal("T", pn("[?thingy T|F]"), "numbers as bools 3")
        assert.equal("T", pn("[!thingy F|T]"), "numbers as bools 4")
        pn("{set thingy to 3}")
        assert.equal("T", pn("[?thingy T|F]"), "numbers as bools 5")
        assert.equal("T", pn("[!thingy F|T]"), "numbers as bools 6")

        assert.equal("<li>1 </li><li>2&nbsp; </li>", pn("<li> 1 </li>       <li>2  </li>    "), "HTML doesn't get NBSPs shoved between nodes")

    } catch (ex) {
        console.log("Zelazny simple parser tests failed: " + ex)
        return
    }
    console.log("Zelazny simple parser tests passed")
}

function testMerge() {
    try {
        assert.equal("bob", pnt("[?pf bob]"), "positive merge, bookend tag")
        assert.equal("", pnt("[?not bob]"), "negative tag, empty output")
        assert.equal(" tim ", pnt(" [?not bob|tim] "), "if/else, whitespace borders, negative result")
        assert.equal(" bob&nbsp; ", pnt(" [?pf bob|tim]  "), "if/else, whitespace borders, positive result")

        assert.equal("steve", pnt("[?pf [?not bob|steve]|[?sf jane|ann]]"), "nested merge, 1")
        assert.equal("bob", pnt("[?pf [?nf bob|steve]|[?garbage jane|ann]]"), "nested merge, 2")
        assert.equal("jane", pnt("[?not [?nf bob|steve]|[?sf jane|ann]]"), "nested merge, 3")
        assert.equal("ann", pnt("[?not [?nf bob|steve]|[?garbage jane|ann]]"), "nested merge, 4")

        //Now do the same thing in reverse
        assert.equal("", pnt("[!pf bob]"), "!positive merge, bookend tag")
        assert.equal("bob", pnt("[!not bob]"), "!negative tag, empty output")
        assert.equal(" bob ", pnt(" [!not bob|tim] "), "!if/else, whitespace borders, negative result")
        assert.equal(" tim&nbsp; ", pnt(" [!pf bob|tim]  "), "!if/else, whitespace borders, positive result")

        assert.equal("ann", pnt("[!pf [!not bob|steve]|[!sf jane|ann]]"), "nested !merge, 1")
        assert.equal("jane", pnt("[!pf [!nf bob|steve]|[!garbage jane|ann]]"), "nested !merge, 2")
        assert.equal("bob", pnt("[!not [!not bob|steve]|[!sf jane|ann]]"), "nested !merge, 3")
        assert.equal("steve", pnt("[!not [!nf bob|steve]|[!garbage jane|ann]]"), "nested !merge, 4")

        assert.equal("worked", pnt("[?sf [?nf [?pf [?not fail1 | worked]]|[?not fail3 | fail2]]|[!garbage fail4|fail5]]"), "deep nesting")
        assert.equal("worked", pnt("[?sf [?nf [?pf [?not fail1 | worked]]|[?not fail3 | fail2]]|[!garbage fail4]]"), "deep nesting2")

        assert.throws(() => {pnt("[?not [?nf bob|steve]|[?garbage jane|ann]")}, "'Missing ]' error catch")
        assert.throws(() => {pnt("[?not [?nf bob|steve]|[?garbage jane|ann]]]")}, "'too many ]' error catch")
        assert.throws(() => {pnt("[?not [?nf bob|steve]]|[?garbage jane|ann]]")}, "'too many ]' error catch 2")

        assert.equal("good", pnt("[>nope:2 bad|good]"), "GT null")
        assert.equal("good", pnt("[>nt:2 good|bad]"), "GT test")
        assert.equal("good", pnt("[>nt:3 bad|good]"), "GT test 2")

        assert.equal("good", pnt("[<nope:1 bad|good]"), "LT null")
        assert.equal("good", pnt("[<nt:2 good|bad]"), "LT test")
        assert.equal("good", pnt("[<nt:1 bad|good]"), "LT test 2")
        assert.equal("good", pnt("[=nt:2 good|bad]"), "EQ test")
        assert.equal("good", pnt("[=nt:3 bad|good]"), "EQ test 2")
        assert.equal("good", pnt("[=nt:1 bad|good]"), "EQ test 3")

        assert.equal("<b>good</b>", pnt("[=nt:1 bad|*good*]"), "nested formatting")
        assert.equal("<b>good</b>", pnt("*[=nt:1 bad|good]*"), "outer formatting preserved")
        assert.equal("<b><i>good</i></b>", pnt("*[=nt:1 bad|\\good\\]*"), "inner/outer formatting preserved")

        assert.throws(() => {pnt("[>nt wah wah wah]")}, "'not enough comparitors for GT' error catch")
        assert.throws(() => {pnt("[<nt:3:4 wah wah wah]")}, "'too many comparitors for LT' error catch")

        pnt("{it is fa}")
        pnt("{it is fb}")
        pnt("{it is fc}")
        assert.equal("T", pnt("[1 [?fa T][?fb T][?fc T]]"), "First works with all true")
        assert.equal("T", pnt("[1 [?fn T][?fn T][?fc T]]"), "First works one true")
        assert.equal("", pnt("[1 [?fn T][?fn T][?nc T]]"), "First works one true")

        assert.equal("T", pnt("[1 [?fa T] [?fb T] [?fc T]]"), "First works with all true (spaces)")
        assert.equal("T", pnt(`[1 [?fa T] 
        [?fb T] 
        [?fc T]]`), "First works with all true (newlines)")


    } catch (ex) {
        console.log("Zelazny parser merge tests failed: " + ex)
        return
    }
    console.log("Zelazny parser merge tests passed")
}

function testComposition() {
    try {
        var newState = gs.create(emptyState)
        var pnsfc = (c) => z.parse(newState, c)
        
        z.parse(newState, "{it is dark}")
        assert.equal("good", pnsfc("[?dark good]"), "can set flag")
        assert.equal("dark", newState.flags.node[0].flag, "correct flag set")

        z.parse(newState, "{player is stinky}")
        assert.equal("stinky", newState.flags.pc[0].flag, "correct flag set 2")

        z.parse(newState, "{chapter is honking}")
        assert.equal("honking", newState.flags.story[0].flag, "correct flag set 3")

        z.parse(newState, "{is not dark}")
        assert.equal("good", pnsfc("[?dark bad|good]"), "can clear flag")

        z.parse(newState, "{is not dark}")
        assert.equal("good", pnsfc("[?dark bad|good]"), "can clear flag")

        assert.equal("1", pnsfc("[&!dark,?honking,?stinky 1|0]"), "boolean AND")
        assert.equal("1", pnsfc("[&?dark,!honking,!stinky 0|1]"), "boolean AND 2")
        assert.equal("1", pnsfc("[&?dark,?honking,?stinky 0|1]"), "boolean AND 3")
        assert.equal("1", pnsfc("[|?dark,?honking,?stinky 1|0]"), "boolean OR")
        assert.equal("1", pnsfc("[|?dark,!honking,?stinky 1|0]"), "boolean OR 2")
        assert.equal("1", pnsfc("[|?dark,!honking,!stinky 0|1]"), "boolean OR 3")

        z.parse(newState, "{is fungible}")
        assert.equal("1", pnsfc("[?fungible 1{is not fungible}]"), "commands in merges, part 1")
        assert.equal("", pnsfc("[?fungible 1{is not fungible}]"), "commands in merges, part 2")
    
    } catch (ex) {
        console.log("Zelazny parser composition tests failed: " + ex)
        return
    }
    console.log("Zelazny parser composition tests passed")
}

function testEnums() {
    try {
        var newState = gs.create(emptyState)
        var p = (c) => z.parse(newState, c)
        
        assert.equal("01234", p("{it can be dark or light}[?dark 0|x]{it is light}[?dark x|1][?light 2|x]{it is dark}[?light x|3][?dark 4|x]"), "simple enumeration toggling")
        
        newState = gs.create(emptyState)
        assert.throws(() => { z.parse(newState, "{it is dark}", "{can be dark or light}") }, '"can\'t make enum if flag blocks" error catch')
  
    } catch (ex) {
        console.log("Zelazny parser enums tests failed: " + ex)
        return
    }
    console.log("Zelazny parser enums tests passed")
}

function testTraits() {
    try {
        var newState = gs.create(emptyState)
        var p = (c) => z.parse(newState, c)
        
        p("{can have trait from -5 to 5}")
        assert.equal("T", p("[=trait:-5 T|F]"), "basic trait 1")
        p("{increment trait}")
        p("{increment trait}")
        p("{increment trait}")
        p("{increment trait}")
        assert.equal("T", p("[=trait:-1 T|F]"), "basic trait 2")
        p("{increment trait}")
        p("{increment trait}")
        p("{increment trait}")
        p("{increment trait}")
        p("{increment trait}")
        p("{increment trait}")
        p("{increment trait}")
        p("{increment trait}")
        p("{increment trait}")
        p("{increment trait}")
        assert.equal("T", p("[=trait:5 T|F]"), "basic trait 3")

        p("{set trait to 3}")
        assert.equal("T", p("[=trait:3 T|F]"), "explicit trait")

        p("{set trait to 0}")
        assert.equal("T", p("[=trait:0 T|F]"), "zero equivalence")
        assert.equal("T", p("[?trait F|T]"), "zero is false")
        
        p("{inc trait by 3}")
        assert.equal("T", p("[=trait:3 T|F]"), "increase by")
        p("{dec trait by 2}")
        assert.equal("T", p("[=trait:1 T|F]"), "decrease by")

        p("{set trait to 100}")
        assert.equal("T", p("[=trait:5 T|F]"), "upper bounds")
        p("{set trait to -100}")
        assert.equal("T", p("[=trait:-5 T|F]"), "lower bounds")

        p("{you can have val from 1 to 4}")
        assert.equal("T", p("[=val:1 T|F]"), "xp step 1")
        p("{add 5 xp to val}")
        assert.equal("T", p("[=val:1 T|F]"), "xp step 2")
        p("{add 5 xp to val}")
        assert.equal("T", p("[=val:2 T|F]"), "xp step 3")
        p("{add 500 xp to val}")
        assert.equal("T", p("[=val:4 T|F]"), "xp step 4")
    } catch (ex) {
        console.log("Zelazny parser traits tests failed: " + ex)
        return
    }
    console.log("Zelazny parser traits tests passed")
}

function testLinks() {
    try {
        var newState = gs.create(opts)
        var p = (c) => z.parse(newState, c)
        
        assert.equal("<a class='action-link'>link </a><div class='code' style='display:none'>it is dark</div>", 
                        p("`link [?dark  black]` => {it is dark}"), "simple link formatting")
        assert.equal("<a class='action-link'>link black</a><div class='code' style='display:none'>it is light</div>", 
                        p("{it is dark}`link [?dark  black]` => {it is light}"), "link with flag formatting")

        newState.lives = 1
        newState.boons = 1
        assert.equal("<a class='botch-link'>link black</a><div class='code' style='display:none'>it is dark</div>", 
                        p("`!link [?dark  black]` => {it is dark}"), "botch links")
        assert.equal("<a class='boon-link'>link black</a><div class='code' style='display:none'>it is dark</div>", 
                        p("`$link [?dark  black]` => {it is dark}"), "boon links")

        newState.lives = 0
        newState.boons = 0
        assert.equal("", 
                        p("`!link [?dark  black]` => {it is dark}"), "botch links (none left)")
        assert.equal("", 
                        p("`$link [?dark  black]` => {it is dark}"), "boon links (none left)")

        assert.throws(() => { z.parse(newState, "`Unterminated link") }, 'links must be terminated')
        assert.throws(() => { z.parse(newState, "`L`") }, 'missing arrow 1')
        assert.throws(() => { z.parse(newState, "`L` and stuff") }, 'missing arrow 2')
        assert.throws(() => { z.parse(newState, "`L` ==>") }, 'missing arrow 3')
        assert.throws(() => { z.parse(newState, "`L` =>") }, 'missing command 1')
        assert.throws(() => { z.parse(newState, "`L` => stuff") }, 'missing command 2')
        assert.throws(() => { z.parse(newState, "`L` => {it is dark") }, 'missing command 3')
    } catch (ex) {
        console.log("Zelazny parser links tests failed: " + ex)
        return
    }
    console.log("Zelazny parser links tests passed")
}

function testRanges() {
    try {
        var newState = gs.create(opts)
        var p = (c) => z.parse(newState, c)
        
        p("{you can have val from -5 to 5}")
        p("{set val to 0}")

        assert.equal("1", p("[=val:0 1|0]"), "ranges, basic shit")
        assert.equal("2", p("[:val -1:1|1:2|-3:0|3:4|5]"), "non-inclusive range")
        assert.equal("2", p("[:val -3:0|-1:1|0:2|1:4|5]"), "inclusive range")

        assert.throws(() => { p("[:val -3:0|-1:1|0:2|-3:4|5]") }, 'duplicate key exception')
        assert.throws(() => { p("[:val -3:0|-1:1|0:2|-3:4|5]") }, 'duplicate default exception')
        
        p("{set val to 2}")
        p("{add 2 xp to val}")
        assert.equal("1", p("[=val:2 1|0]"), "ranges, basic shit 2")
        assert.equal("2", p("[:val 0:0|1:1|2:2|3:3|5]"), "Make sure 'xp' doesn't skew range (ie, 1.1 is not 2, neither is 1.9 for our purposes)")

        //In some implementations the flag level will get incrementally adjusted (so flag.level will actually be 2.2 or whatever), test that:
        newState.flags.pc[0].level = 2.2
        assert.equal("1", p("[=val:2 1|0]"), "ranges, basic shit 3")
        assert.equal("2", p("[:val 0:0|1:1|2:2|3:3|5]"), "Make sure 'xp' doesn't skew range (ie, 1.1 is not 2, neither is 1.9 for our purposes) 2")

        p("{set val to 4}")
        assert.equal("5", p("[:val -3:0|-1:1|0:2|1:4|5]"), "default works in range")

    } catch (ex) {
        console.log("Zelazny parser ranges tests failed: " + ex)
        return
    }
    console.log("Zelazny parser ranges tests passed")
}

function testMacros() {
    try {
        var newState = gs.create(emptyState)
        var p = (c) => z.parse(newState, c)
        
        z.registerMacro("test", (z, s, c) => {
            return "hee haw " + c
        })

        assert.equal("hee haw 123", p("^test 123~"), "basic macro")
        p("{it is flagged}")
        assert.equal("hee haw 123", p("[?flagged ^test 123~]"), "macro in merge")
        assert.equal("hee haw 123", p("^test [?flagged 123|456]~"), "merge in macro")
        
        z.registerMacro("test2", (z, s, c) => {
            return "[?" + c + " 1|0]"
        })
        assert.equal("1", p("^test2 flagged~"), "code returned by macro 1")
        assert.equal("0", p("^test2 blork~"), "code returned by macro 2")
  
    } catch (ex) {
        console.log("Zelazny parser macro tests failed: " + ex)
        return
    }
    console.log("Zelazny parser macro tests passed")
}

function testSpecialModes() {
    try {
        var closureText = ''

        var newState = gs.create({navigate: dest => {}, specialLog: (text) => {closureText = text} })
        var p = (c) => z.parse(newState, c)
        
        assert.equal(false, newState.inDialogueMode, "Not in dialogue mode by default")
        assert.equal(false, newState.isRoom, "Not a room by default")
        p("{dialogue node}")
        assert.equal(true, newState.inDialogueMode, "Transition into dialogue mode")
        p("{go to 123}")
        assert.equal(false, newState.inDialogueMode, "Not in dialogue mode after node transition")
        
        //assert.throws(() => { p("[\"topic Blah blah blah]") }, 'special merge throws outside special node: dialogue topic')
        //assert.throws(() => { p("[@Blah blah blah]") }, 'header throws outside special node: dialogue')
        assert.throws(() => {  p("{topic cars}") }, 'topic command throws outside special node: dialogue')

        p("{dialogue node}")
        assert.equal('', p('["cars Your dad says, "I like Ford."]'), 'dialogue:  Not showing topic')
        assert.equal('', closureText, "dialogue topic callback has not been called yet")
        p("{topic cars}")
        assert.equal('Garumph', p('[@Garumph]'), 'dialogue:  Shows header once when appropriate')
        assert.equal('', p('[@Garumph]'), 'dialogue:  does not show header when appropriate')
        assert.equal('Garumph', closureText, "header callback called as expected")
        assert.equal('Harumph', p('["cars Harumph]'), 'dialogue:  Shows topic once when appropriate')
        assert.equal('Harumph', closureText, "dialogue topic callback called as expected")
        assert.equal('', p('["cars Your dad says, "I like Ford."]'), 'dialogue:  Not showing topic on second try')

        p("{go to 125}")
        assert.equal("1", p("[@1]"), "first time dialogue tag works first time")
        assert.equal("", p("[@1]"), "first time dialogue tag works second time (by not working)")

        p("{go to urmom}")
        assert.equal(false, newState.isRoom, "Not a room by default after transition")
        assert.equal('', newState.roomName, "Room name empty")
        p("{room node}")
        assert.equal(true, newState.isRoom, "Transition into room")
        p("{name This Room I Made}")
        assert.equal('This Room I Made', newState.roomName, "Can set room name")
        p("{go to 123}")
        assert.equal(false, newState.isRoom, "Not a room after node transition")
        assert.equal('', newState.roomName, "Room name empty after transition")

        p(`{room node\n
            name This Room I Made}`)
        assert.equal(true, newState.isRoom, "Transition into room 2")
        assert.equal('This Room I Made', newState.roomName, "Can set room name (test command parser bug from earlier)")
  
        p('{log Hello nurse!}')
        assert.equal("Hello nurse!", closureText, "test log command")

        p('{log Why.  Do I care?}')
        assert.equal("Why.&nbsp; Do I care?", closureText, "test log command is being parsed")

        p('{log Literally fuck yourself.&nbsp;&nbsp;}')
        assert.equal("Literally fuck yourself.&nbsp;&nbsp;", closureText, "test log ending in sentence on it's own line bug")

    } catch (ex) {
        console.log("Zelazny parser modes tests failed: " + ex)
        return
    }
    console.log("Zelazny parser modes tests passed")
}

testSimple()
testMerge()
testComposition()
testEnums()
testTraits()
testLinks()
testRanges()
testMacros()
testSpecialModes()
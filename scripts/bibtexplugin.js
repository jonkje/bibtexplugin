/***
    |''name''         | BibTeXPlugin |
    |''Description''  |  |
    |''Version''      | alpha0 |
    |''Date''         | the future |
    |''Source''       | right here! |
    |''Author''       | Jon Øyvind Kjellman |
    |''License''      | MIT/BSD don't know yet |
    |''~CoreVersion'' | 2.5.0 |
    |''Browser''      | Opera 11.61+ |
***/

// Plugin namespace
var plugin = config.extensions.BibTeXPlugin = {}

// BibTeX parser code. Originally written and published by ??? as bibtex_js.
// Issues:
//  no comment handling within strings
//  no string concatenation
//  no variable values yet

// Grammar implemented here:
//  bibtex -> (string | preamble | comment | entry)*;
//  string -> '@STRING' '{' key_equals_value '}';
//  preamble -> '@PREAMBLE' '{' value '}';
//  comment -> '@COMMENT' '{' value_comment '}';
//  entry -> '@' key '{' key ',' key_value_list '}';
//  key_value_list -> key_equals_value (',' key_equals_value)*;
//  key_equals_value -> key '=' value;
//  value -> value_quotes | value_braces | key;
//  value_comment -> .*? // or something??
//  value_quotes -> '"' .*? '"'; // not quite
//  value_braces -> '{' .*? '"'; // not quite
plugin.BibtexParser = function () {
    this.pos = 0;
    this.input = "";
    
    this.entries = {};
    this.strings = {
	JAN: "January",
	FEB: "February",
	MAR: "March",      
	APR: "April",
	MAY: "May",
	JUN: "June",
	JUL: "July",
	AUG: "August",
	SEP: "September",
	OCT: "October",
	NOV: "November",
	DEC: "December"
    };
    this.currentKey = "";
    this.currentEntry = "";

    this.setInput = function(t) {
	this.input = t;
    }
    
    this.getEntries = function() {
	return this.entries;
    }

    this.isWhitespace = function(s) {
	return (s == ' ' || s == '\r' || s == '\t' || s == '\n');
    }

    this.currentIsEscaped = function() {
	var slashcount = 0
	for(var	p = this.pos-1; p >= 0; p--) {
	    if(this.input[p] == '\\') {
		slashcount++
	    } else {
		break
	    }
	}
	return (slashcount % 2 == 1)
    }

    this.match = function(s) {
	this.skipWhitespace();
	if (this.input.substring(this.pos, this.pos+s.length) == s) {
	    this.pos += s.length;
	} else {
	    throw "Token mismatch, expected " + s + ", found " + this.input.substring(this.pos);
	}
	this.skipWhitespace();
    }

    this.tryMatch = function(s) {
	this.skipWhitespace();
	if (this.input.substring(this.pos, this.pos+s.length) == s) {
	    return true;
	} else {
	    return false;
	}
	this.skipWhitespace();
    }

    this.skipWhitespace = function() {
	while (this.isWhitespace(this.input[this.pos])) {
	    this.pos++;
	}
	if (this.input[this.pos] == "%") {
	    while(this.input[this.pos] != "\n") {
		this.pos++;
	    }
	    this.skipWhitespace();
	}
    }

    this.value_comment = function() {
	var bracecount = 0;
	var start = this.pos;
	while(true) {
	    if (this.input[this.pos] == '}' && !this.currentIsEscaped()) {
		if (bracecount > 0) {
		    bracecount--;
		} else {
		    var end = this.pos;
		    return this.input.substring(start, end);
		}
	    } else if (this.input[this.pos] == '{' && !this.currentIsEscaped()) {
		bracecount++;
	    } else if (this.pos == this.input.length-1) {
		throw "Unterminated value";
	    }
	    this.pos++;
	}
    }

    this.value_braces = function() {
	this.match("{");
	var val = this.value_comment()
	this.match("}");
	return val
    }

    this.value_quotes = function() {
	this.match('"');
	var val = this.value_comment()
	this.match('"');
	return val
    }
    
    this.single_value = function() {
	var start = this.pos;
	if (this.tryMatch("{")) {
	    return this.value_braces();
	} else if (this.tryMatch('"')) {
	    return this.value_quotes();
	} else {
	    var k = this.key();
	    if (this.strings[k.toUpperCase()]) {
		return this.strings[k];
	    } else if (k.match("^[0-9]+$")) {
		return k;
	    } else {
		throw "Value expected:" + this.input.substring(start);
	    }
	}
    }
    
    this.value = function() {
	var values = [];
	values.push(this.single_value());
	while (this.tryMatch("#")) {
	    this.match("#");
	    values.push(this.single_value());
	}
	return values.join("");
    }

    this.key = function() {
	var start = this.pos;
	while(true) {
	    if (this.pos == this.input.length) {
		throw "Runaway key";
	    }
	    
	    if (this.input[this.pos].match("[a-zA-Z0-9_:\\./-]")) {
		this.pos++
	    } else {
		return this.input.substring(start, this.pos).toUpperCase();
	    }
	}
    }

    this.key_equals_value = function() {
	var key = this.key();
	if (this.tryMatch("=")) {
	    this.match("=");
	    var val = this.value();
	    //	    console.log("Parsed key/value pair: "+key+" = "+val)
	    return [ key, val ];
	} else {
	    throw "... = value expected, equals sign missing:" + this.input.substring(this.pos);
	}
    }

    this.key_value_list = function() {
	this.entries[this.currentEntry]["KEY"] = this.currentEntry;
	var kv = this.key_equals_value();
	this.entries[this.currentEntry][kv[0]] = kv[1];
	while (this.tryMatch(",")) {
	    this.match(",");
	    // fixes problems with commas at the end of a list
	    if (this.tryMatch("}")) {
		break;
	    }
	    kv = this.key_equals_value();
	    this.entries[this.currentEntry][kv[0]] = kv[1];
	}
    }

    this.entry_body = function() {
	this.currentEntry = this.key();
	this.entries[this.currentEntry] = new Object();    
	this.match(",");
	this.key_value_list();
    }

    this.directive = function () {
	this.match("@");
	return "@"+this.key();
    }

    this.string = function () {
	var kv = this.key_equals_value();
	this.strings[kv[0].toUpperCase()] = kv[1];
    }

    this.preamble = function() {
	this.value();
    }

    this.comment = function() {
	this.value_comment();
    }

    this.entry = function() {
	this.entry_body();
    }

    this.bibtex = function() {
	while(this.tryMatch("@")) {
	    var d = this.directive().toUpperCase();
	    this.match("{");
	    if (d == "@STRING") {
		this.string();
	    } else if (d == "@PREAMBLE") {
		this.preamble();
	    } else if (d == "@COMMENT") {
		this.comment();
	    } else {
		this.entry();
	    }
	    this.match("}");
	}
    }
}

plugin.Template = function(template_str) {
    this.StringElement = function(str, next) {
	this.str  = typeof str  === undefined ? "" : str
	this.next = typeof next === undefined ? null : next
    }

    this.KeyElement = function(key, next) {
	this.key  = key
	this.next = typeof next === undefined ? null : next
    }

    this.ConditionalElement = function(condition, next_exist, next_noexist) {
	this.condition    = condition
	this.next_exist   = next_exist
	this.next_noexist = next_noexist
    }

    this.isEscaped = function(str, pos) {
	//	console.log("isEscaped(\"" + str.substring(0, pos+1) + "\", " + pos + ")")
	var slashcount = 0
	while(--pos >= 0) {
	    if(str[pos] == '\\') {
		slashcount++
	    } else {
		break
	    }
	}
	return slashcount > 0 && slashcount % 2 == 1
    }

    // Parses a template string recursively, returning a chain of
    // elements (Key, String and/or Conditional) with the last
    // element(s) linking to tail.
    this.parseString = function(str, tail) {
	//	console.log("\nparsing string: " + str)
	var prefix = null
	
	// For proper handling of empty strings in conditionals.
	if(str === "" && tail !== null) { return new this.StringElement("", tail) }
	
	// Prefix string
	for(var parsepos = 0; true; parsepos++) {
	    if(str[parsepos] == '$' && str[parsepos+1] == '{' && !this.isEscaped(str, parsepos)) {
		if(parsepos > 0) {
		    prefix = new this.StringElement(str.substring(0, parsepos), tail)
		}
		break
	    }
	    
	    // End of string, it must be a pure text string!
	    if(parsepos >= str.length-3) { return new this.StringElement(str, tail) }
	}

	// Find element delimiters (',' and '}')
	parsepos += 2
	var commacount = 0
	var commapos   = new Array()
	var bracketcnt = 1
	var startpos   = parsepos
	var endpos     = 0
	
	// Find commas and end of statement
	for(; parsepos < str.length; parsepos++) {
	    if(str[parsepos] == '{' && !this.isEscaped(str, parsepos)) {
		bracketcnt++
	    } else if(str[parsepos] == '}' && !this.isEscaped(str, parsepos)) {
		if(--bracketcnt == 0) {
		    endpos = parsepos
		    parsepos++
		    break
		}
	    } else if(str[parsepos] == ',' && !this.isEscaped(str, parsepos)) {
		commapos[commacount] = parsepos
		if(++commacount > 2) {
		    return new this.StringElement("Template parse error! (Too many commas)", tail)
		}
	    }
	}
	
	// Check that the element is complete.
	if(bracketcnt != 0) { return new this.StringElement("Template parse error! (Unmatched bracket)", tail) }
	
	// Parse tail of current string
	var innertail = this.parseString(str.substring(endpos+1), tail)
	
	var first_element
	
	switch(commacount) {
	case 0:
	    first_element = new this.KeyElement(str.substring(startpos, endpos), innertail)
	    break
	case 1:
	    var cond_element = this.parseString(str.substring(commapos[0]+1, endpos), innertail)
	    first_element = new this.ConditionalElement(str.substring(startpos, commapos[0]).toUpperCase(),
							cond_element,
							innertail)
	    break
	case 2:
 	    var cond_element1 = this.parseString(str.substring(commapos[0]+1, commapos[1]), innertail)
	    var cond_element2 = this.parseString(str.substring(commapos[1]+1, endpos), innertail)
	    first_element = new this.ConditionalElement(str.substring(startpos, commapos[0]).toUpperCase(),
							cond_element1, cond_element2)
	}
	
	if(prefix == null) {
	    return first_element
	} else {
	    prefix.next = first_element
	    return prefix
	}
    }
    
    this.template_head = null
    
    this.parseTemplate = function(template_str) {	
	this.template_head = this.parseString(template_str, null)
	if(this.template_head === null) {
	    this.template_head = new this.StringElement("")
	}
    }
    
    this.parseTemplate(template_str)
}

plugin.Template.prototype.tiddlyfy = function(entry) {
    var rtrn_str = ""
    var e = this.template_head
    do {
	if(e instanceof this.StringElement) {
	    rtrn_str += e.str
	    e = e.next
	} else if(e instanceof this.KeyElement) {
	    var val = entry[e.key]
	    if(e.key === "URL") {
		rtrn_str += val
	    } else {
		rtrn_str += val !== undefined ? val:""//"\"\"\"" + val + "\"\"\"" : ""
	    }
	    e = e.next
	} else if(e instanceof this.ConditionalElement) {
	    var val = entry[e.condition]
	    e = val !== undefined ? e.next_exist : e.next_noexist
	}
    } while(e != null)
    
    return rtrn_str
}

plugin.loadBibliography = function(caller) {
    console.log("plugin.loadBibliography called by: " + caller)
    // Load bibliography from external file
    var bibfilename = store.getTiddlerText("BibTeXPluginFilename");
    var bibdata = ""
    if(bibfilename !== "") {
	jQuery.ajax({url: bibfilename,
		     success: function(data) { bibdata = data; },
		     async: false })
    } else {
	bibdata = store.getTiddlerText("BibTeXPluginBibliography")
    }
    
    plugin.bibtexparser = new plugin.BibtexParser()
    plugin.bibtexparser.setInput(bibdata)
    plugin.bibtexparser.bibtex()
    plugin.template     = new plugin.Template([ "''${TITLE}''\n${YEAR},''${AUTHOR}'',//${JOURNAL,${JOURNAL}\\,,${PUBLISHER}}//",
					      "${VOLUME,vol. ${VOLUME}} ${URL,([[online version|${URL}]])}" ].join(""))
}

// Set-up shadow tiddlers
// Create stylesheet (see:
// http://tiddlywiki.org/#%5B%5BBundling%20CSS%20in%20plugins%5D%5D
// for release modifications)
plugin.stylesheet = [ "a.bibtexbox { position: relative; }\n",
		      "a.bibtexbox span {",
		      "  display: none;",
		      "  position: absolute;",
		      "  z-index: 1000;",
		      "  left: -100%;",
		      "  width: 300%;",
		      "  padding: 5px;",
		      "  border:1px solid [[ColorPalette::SecondaryMid]];",
		      "  background: [[ColorPalette::SecondaryLight]];",
		      "  color:[[ColorPalette::Foreground]]; }" ].join("")
config.shadowTiddlers["BibTeXPluginStyleSheet"] = "/*{{{*/\n%0\n/*}}}*/".format(plugin.stylesheet)
store.addNotification("BibTeXPluginStyleSheet", refreshStyles)

// Load BibTeX file/content from (shadow) tiddlers. The notification
// callbacks will get called once for each of the two tiddlers,
// causing the data to be loaded.
config.shadowTiddlers["BibTeXPluginFilename"] = ""
store.addNotification("BibTeXPluginFilename", plugin.loadBibliography)
config.shadowTiddlers["BibTeXPluginBibliography"] = ""
store.addNotification("BibTeXPluginBibliography", plugin.loadBibliography)

// Define macros 'bibtex' and 'bibliography'                
config.macros.bibtex = {
    handler: function(place, macroName, params) {
	console.log("Executing macro bibtex")
	var entry = plugin.bibtexparser.entries[params[0].toUpperCase()]
	var tiddlystr = entry !== undefined ? plugin.template.tiddlyfy(entry) : "No such entry in bibliography!"
	var citea     = createTiddlyElement(place, "a", null, "bibtexbox", "("+params[0]+")")
	var citespan  = createTiddlyElement(citea, "span")
	wikify(tiddlystr, citespan)
	console.log("tiddlystr: " + tiddlystr)

	citea.onclick = function() { citespan.style.display = citespan.style.display !== "block" ? "block" : "none" }
	citespan.onclick = function() { citespan.style.display = "none" }
    }
}

config.macros.bibliography = {
    handler: function(place, macroName, params) {
	var tiddlystr = ""
	for(var k in plugin.bibtexparser.entries) {
	    var entry = plugin.bibtexparser.entries[k]
	    if(entry["KEY"] !== undefined) {
		tiddlystr += ";\"\"\"" + entry["KEY"] + "\"\"\"\n"
		tiddlystr += ":{{bibtexdummycss{" + plugin.template.tiddlyfy(entry) + "}}}\n"
	    }
	}
	wikify(tiddlystr, place)
    }
}
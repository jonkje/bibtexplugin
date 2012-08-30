/***
|''name''         | BibTeXPlugin |
|''Description''  | Allows references to external BibTeX file |
|''Version''      | alpha0 |
|''Date''         | the future |
|''Source''       | right here! |
|''Author''       | Jon Øyvind Kjellman |
|''License''      | MIT/BSD don't know yet |
|''~CoreVersion'' | 2.5.0 |
|''Browser''      | Opera |
***/

jQuery.getScript("http://ajax.googleapis.com/ajax/libs/jquery/1.4.2/jquery.min.js")
//jQuery.getScript("http://bibtex-js.googlecode.com/svn/trunk/src/bibtex_js.js")
jQuery.getScript("scripts/bibtex_js.js")

// Load bibliography from external file
//var bibfile = "../../../artikler/database.bib";
var bibfile = "testdb.bib";

bibel = document.createElement("textarea")
bibel.setAttribute("id", "bibtex_input")
bibel.setAttribute("style", "display:none")
jQuery.get(bibfile, function(data) { bibel.appendChild(document.createTextNode(data)); })
document.body.appendChild(bibel)

// check for template, create if needed
//default_template = "($(BIBTEXKEY)) {$(AUTHOR) ? ''$(AUTHOR)'' : }\n{   //$(TITLE)//}"

// parse template
//template_div = 

/*
foo = store.fetchTiddler("Template")
console.log(foo.text)
*/
//templatetiddler = store.fetchTiddler("BibTeXTemplate")
//if(typeof templatetiddler == "undefined") {
    templateel = document.createElement("div")
    templateel.setAttribute("class", "bibtex_template")
    templateel.setAttribute("style", "display:none")
    templateel.innerHTML =
	"<div class=\"if bibtexkey\">(<span class=\"bibtexkey\"></span>)</div>"+
	"<div class=\"if author\" style=\"font-weight: bold;\">"+
	"  <span class=\"if year\">"+
	"    <span class=\"year\"></span>,"+
	"  </span>"+
	"  <span class=\"author\"></span>"+
	"  <span class=\"if url\" style=\"margin-left: 20px\">"+
	"    <a class=\"url\" style=\"color:black; font-size:10px\">(view online)</a>"+
	"  </span>"+
	"</div>"+
	"<div style=\"margin-left: 10px; margin-bottom:5px;\">"+
	"  <span class=\"title\"></span>"
    document.body.appendChild(templateel)
/*    templatetiddler = store.createTiddler(BibTeX
    .loadFromDiv(templateel, "BibTeXTemplate")*/
//}

// Should show up somwhere on the page if it works!?
//createTiddlyElement(document.body, "div", "bibtex_display", null, null)
    
/*    alert("hello")
    alert(typeof window.bibtex_js_draw)

    bibtex_js_draw();
}*/

config.macros.bibliography = {}
config.macros.bibliography.handler = function(place, macroName, params) {
    createTiddlyElement(place, "div", "bibtex_display", null, null)
    if(typeof bibtex_js_draw == "undefined") {
	console.log("No bibtex_js_draw() yet; trying again in 5 seconds.\n\n")
	setTimeout(function() {
	    if(typeof bibtex_js_draw != "undefined") {
		bibtex_js_draw()
	    } else {
		console.log("no bibtex_js_draw() yet\n\n")
	    }
	}, 2000)
    } else {
	bibtex_js_draw()
    }
}

function Template(template_tiddler) {
    this.template_tiddler = template_tiddler

    this.StringElement = function(str, next) {
	this.str  = typeof str  === "undefined" ? "" : str
	this.next = typeof next === "undefined" ? null : str
    }

    this.KeyElement = function(key, next) {
	this.key  = key
	this.next = typeof next === "undefined" ? null : str
    }

    this.ConditionalElement = function(condition, next_exist, next_noexist) {
	this.condition    = condition
	this.next_exist   = next_exist
	this.next_noexist = next_noexist
    }

    this.isEscaped = function(str, pos) {
	    var slashcount = 0
	    while(--pos >= 0) {
		if(template[pos] == '\\') {
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
	var prefix = null

	// For proper handling of empty strings in conditionals.
	if(str === "" && tail !== null) { return new StringElement("", tail) }

	// Prefix string
	for(var parsepos = 0 ; parsepos < template.length; parsepos++) {
	    if(template[parsepos] == '$' && template[parsepos+1] == '{' && !isEscaped()) {
		if(parsepos > 0) {
		    prefix = new StringElement(str.substring(last_end, parsepos))
		}
		break
	    }
	}

	// Pure text string
	if(parsepos >= template.length) { return rtrn_elment; }

	// Find element delimiters (',' and '}')
	parsepos += 2
	var commacount = 0
	var commapos   = new Array()
	var bracketcnt = 1
		
	var startpos   = parsepos
	var endpos     = 0

	// Find commas and end of statement
	for(; parsepos < template.length; parsepos++) {
	    if(template[parsepos] == '{' && !isEscaped()) {
		bracketcnt++
	    } else if(template[parsepos] == '}' && !isEscaped()) {
		if(--bracketcnt == 0) {
		    endpos = parsepos
		    parsepos++
		    break
		}
	    } else if(template[parsepos] == ',' && !isEscaped()) {
		commapos[commacount] = parsepos
		if(++commacount > 2) {
		    return new StringElement("Template parse error! (Too many commas)")
		}
	    }
	}

	// Check that the element is complete.
	if(bracketcnt != 0) { return new StringElement("Template parse error! (Unmatched bracket)") }

	// Parse tail
	tail = parseString(template.substring(endpos+1))
	var first_element
	
	switch(commacount) {
	case 0:
	    first_element = new KeyElement(template.substring(startpos, endpos), tail)
	    break
	case 1:
	    first_element = new ConditionalElement(parseString(template.substring(startpos, commapos[0])),
						   parseString(template.substring(commapos[0]+1, endpos)),
						   tail, tail)
	    break
	case 2:
	    first_element = new ConditionalElement(parseString(template.substring(startpos, commapos[0])),
						   parseString(template.substring(commapos[0]+1, commapos[1])),
						   parseString(template.substring(commapos[1]+1, endpos)),
						   tail)
	}

	if(prefix == null) {
	    return first_element
	} else {
	    prefix.next = first_element
	    return prefix
	}
    }

    this.template_head = null

    this.parseTemplate = function() {
	// Load template tiddler contents
	var template_str  = [ "!!!!!(${KEY}) ${TITLE}\n${YEAR},''${AUTHOR}'',//${JOURNAL,${JOURNAL}\,,${PUBLISHER}}//",
			      "${VOLUME,vol. ${VOLUME}}, ${URL,(${URL})}" ]

	template_head = parseString(template_str)
	if(template_head === null) {
	    template_head = new StringElement("")
	}
    }

    parseTemplate()
}

Template.tiddlyfy = function(entry) {
    var rtrn_str = ""
    var e = template_head
    do {
	if(e instanceof StringElement) {
	    rtrn_str += e.str;
	    e = e.next
	} else if(e instanceof KeyElement) {
	    val = entry[e.key]
	    rtrn_str += p !== undefined ? val : ""
	    e = e.next
	} else if(e instanceof ConditionalElement) {
	    e = jQuery.inArray(entry, e.condition) >= 0 ? e.next_exist : e.next_noexist
	}
    } while(e != null)
    
    return rtrn_str
}

var TurndownBundle=(()=>{var g=(e,r)=>()=>{try{return r||e((r={exports:{}}).exports,r),r.exports}catch(t){throw r=0,t}};var U=g((we,V)=>{"use strict";function Q(e){for(var r=1;r<arguments.length;r++){var t=arguments[r];for(var n in t)Object.prototype.hasOwnProperty.call(t,n)&&(e[n]=t[n])}return e}function A(e,r){return Array(r+1).join(e)}function S(e){return e.replace(/^\n*/,"")}function D(e){for(var r=e.length;r>0&&e[r-1]===`
`;)r--;return e.substring(0,r)}function B(e){return D(S(e))}var J=["ADDRESS","ARTICLE","ASIDE","AUDIO","BLOCKQUOTE","BODY","CANVAS","CENTER","DD","DIR","DIV","DL","DT","FIELDSET","FIGCAPTION","FIGURE","FOOTER","FORM","FRAMESET","H1","H2","H3","H4","H5","H6","HEADER","HGROUP","HR","HTML","ISINDEX","LI","MAIN","MENU","NAV","NOFRAMES","NOSCRIPT","OL","OUTPUT","P","PRE","SECTION","TABLE","TBODY","TD","TFOOT","TH","THEAD","TR","UL"];function y(e){return T(e,J)}var x=["AREA","BASE","BR","COL","COMMAND","EMBED","HR","IMG","INPUT","KEYGEN","LINK","META","PARAM","SOURCE","TRACK","WBR"];function L(e){return T(e,x)}function Z(e){return I(e,x)}var P=["A","TABLE","THEAD","TBODY","TFOOT","TH","TD","IFRAME","SCRIPT","AUDIO","VIDEO"];function ee(e){return T(e,P)}function re(e){return I(e,P)}function T(e,r){return r.indexOf(e.nodeName)>=0}function I(e,r){return e.getElementsByTagName&&r.some(function(t){return e.getElementsByTagName(t).length})}var te=[[/\\/g,"\\\\"],[/\*/g,"\\*"],[/^-/g,"\\-"],[/^\+ /g,"\\+ "],[/^(=+)/g,"\\$1"],[/^(#{1,6}) /g,"\\$1 "],[/`/g,"\\`"],[/^~~~/g,"\\~~~"],[/\[/g,"\\["],[/\]/g,"\\]"],[/^>/g,"\\>"],[/_/g,"\\_"],[/^(\d+)\. /g,"$1\\. "]];function M(e){return te.reduce(function(r,t){return r.replace(t[0],t[1])},e)}var o={};o.paragraph={filter:"p",replacement:function(e){return`

`+e+`

`}};o.lineBreak={filter:"br",replacement:function(e,r,t){return t.br+`
`}};o.heading={filter:["h1","h2","h3","h4","h5","h6"],replacement:function(e,r,t){var n=Number(r.nodeName.charAt(1));if(t.headingStyle==="setext"&&n<3){var i=A(n===1?"=":"-",e.length);return`

`+e+`
`+i+`

`}else return`

`+A("#",n)+" "+e+`

`}};o.blockquote={filter:"blockquote",replacement:function(e){return e=B(e).replace(/^/gm,"> "),`

`+e+`

`}};o.list={filter:["ul","ol"],replacement:function(e,r){var t=r.parentNode;return t.nodeName==="LI"&&t.lastElementChild===r?`
`+e:`

`+e+`

`}};o.listItem={filter:"li",replacement:function(e,r,t){var n=t.bulletListMarker+"   ",i=r.parentNode;if(i.nodeName==="OL"){var a=i.getAttribute("start"),s=Array.prototype.indexOf.call(i.children,r);n=(a?Number(a)+s:s+1)+".  "}var u=/\n$/.test(e);return e=B(e)+(u?`
`:""),e=e.replace(/\n/gm,`
`+" ".repeat(n.length)),n+e+(r.nextSibling?`
`:"")}};o.indentedCodeBlock={filter:function(e,r){return r.codeBlockStyle==="indented"&&e.nodeName==="PRE"&&e.firstChild&&e.firstChild.nodeName==="CODE"},replacement:function(e,r,t){return`

    `+r.firstChild.textContent.replace(/\n/g,`
    `)+`

`}};o.fencedCodeBlock={filter:function(e,r){return r.codeBlockStyle==="fenced"&&e.nodeName==="PRE"&&e.firstChild&&e.firstChild.nodeName==="CODE"},replacement:function(e,r,t){for(var n=r.firstChild.getAttribute("class")||"",i=(n.match(/language-(\S+)/)||[null,""])[1],a=r.firstChild.textContent,s=t.fence.charAt(0),u=3,l=new RegExp("^"+s+"{3,}","gm"),f;f=l.exec(a);)f[0].length>=u&&(u=f[0].length+1);var d=A(s,u);return`

`+d+i+`
`+a.replace(/\n$/,"")+`
`+d+`

`}};o.horizontalRule={filter:"hr",replacement:function(e,r,t){return`

`+t.hr+`

`}};o.inlineLink={filter:function(e,r){return r.linkStyle==="inlined"&&e.nodeName==="A"&&e.getAttribute("href")},replacement:function(e,r){var t=E(r.getAttribute("href")),n=C(p(r.getAttribute("title"))),i=n?' "'+n+'"':"";return"["+e+"]("+t+i+")"}};o.referenceLink={filter:function(e,r){return r.linkStyle==="referenced"&&e.nodeName==="A"&&e.getAttribute("href")},replacement:function(e,r,t){var n=E(r.getAttribute("href")),i=p(r.getAttribute("title"));i&&(i=' "'+C(i)+'"');var a,s;switch(t.linkReferenceStyle){case"collapsed":a="["+e+"][]",s="["+e+"]: "+n+i;break;case"shortcut":a="["+e+"]",s="["+e+"]: "+n+i;break;default:var u=this.references.length+1;a="["+e+"]["+u+"]",s="["+u+"]: "+n+i}return this.references.push(s),a},references:[],append:function(e){var r="";return this.references.length&&(r=`

`+this.references.join(`
`)+`

`,this.references=[]),r}};o.emphasis={filter:["em","i"],replacement:function(e,r,t){return e.trim()?t.emDelimiter+e+t.emDelimiter:""}};o.strong={filter:["strong","b"],replacement:function(e,r,t){return e.trim()?t.strongDelimiter+e+t.strongDelimiter:""}};o.code={filter:function(e){var r=e.previousSibling||e.nextSibling,t=e.parentNode.nodeName==="PRE"&&!r;return e.nodeName==="CODE"&&!t},replacement:function(e){if(!e)return"";e=e.replace(/\r?\n|\r/g," ");for(var r=/^`|^ .*?[^ ].* $|`$/.test(e)?" ":"",t="`",n=e.match(/`+/gm)||[];n.indexOf(t)!==-1;)t=t+"`";return t+r+e+r+t}};o.image={filter:"img",replacement:function(e,r){var t=M(p(r.getAttribute("alt"))),n=E(r.getAttribute("src")||""),i=p(r.getAttribute("title")),a=i?' "'+C(i)+'"':"";return n?"!["+t+"]("+n+a+")":""}};function p(e){return e?e.replace(/(\n+\s*)+/g,`
`):""}function E(e){var r=e.replace(/([<>()])/g,"\\$1");return r.indexOf(" ")>=0?"<"+r+">":r}function C(e){return e.replace(/"/g,'\\"')}function H(e){this.options=e,this._keep=[],this._remove=[],this.blankRule={replacement:e.blankReplacement},this.keepReplacement=e.keepReplacement,this.defaultRule={replacement:e.defaultReplacement},this.array=[];for(var r in e.rules)this.array.push(e.rules[r])}H.prototype={add:function(e,r){this.array.unshift(r)},keep:function(e){this._keep.unshift({filter:e,replacement:this.keepReplacement})},remove:function(e){this._remove.unshift({filter:e,replacement:function(){return""}})},forNode:function(e){if(e.isBlank)return this.blankRule;var r;return(r=v(this.array,e,this.options))||(r=v(this._keep,e,this.options))||(r=v(this._remove,e,this.options))?r:this.defaultRule},forEach:function(e){for(var r=0;r<this.array.length;r++)e(this.array[r],r)}};function v(e,r,t){for(var n=0;n<e.length;n++){var i=e[n];if(ne(i,r,t))return i}}function ne(e,r,t){var n=e.filter;if(typeof n=="string"){if(n===r.nodeName.toLowerCase())return!0}else if(Array.isArray(n)){if(n.indexOf(r.nodeName.toLowerCase())>-1)return!0}else if(typeof n=="function"){if(n.call(e,r,t))return!0}else throw new TypeError("`filter` needs to be a string, array, or function")}function ie(e){var r=e.element,t=e.isBlock,n=e.isVoid,i=e.isPre||function(z){return z.nodeName==="PRE"};if(!(!r.firstChild||i(r))){for(var a=null,s=!1,u=null,l=O(u,r,i);l!==r;){if(l.nodeType===3||l.nodeType===4){var f=l.data.replace(/[ \r\n\t]+/g," ");if((!a||/ $/.test(a.data))&&!s&&f[0]===" "&&(f=f.substr(1)),!f){l=N(l);continue}l.data=f,a=l}else if(l.nodeType===1)t(l)||l.nodeName==="BR"?(a&&(a.data=a.data.replace(/ $/,"")),a=null,s=!1):n(l)||i(l)?(a=null,s=!0):a&&(s=!1);else{l=N(l);continue}var d=O(u,l,i);u=l,l=d}a&&(a.data=a.data.replace(/ $/,""),a.data||N(a))}}function N(e){var r=e.nextSibling||e.parentNode;return e.parentNode.removeChild(e),r}function O(e,r,t){return e&&e.parentNode===r||t(r)?r.nextSibling||r.parentNode:r.firstChild||r.nextSibling||r.parentNode}var R=typeof window<"u"?window:{};function ae(){var e=R.DOMParser,r=!1;try{new e().parseFromString("","text/html")&&(r=!0)}catch{}return r}function le(){var e=function(){};return se()?e.prototype.parseFromString=function(r){var t=new window.ActiveXObject("htmlfile");return t.designMode="on",t.open(),t.write(r),t.close(),t}:e.prototype.parseFromString=function(r){var t=document.implementation.createHTMLDocument("");return t.open(),t.write(r),t.close(),t},e}function se(){var e=!1;try{document.implementation.createHTMLDocument("").open()}catch{R.ActiveXObject&&(e=!0)}return e}var oe=ae()?R.DOMParser:le();function ue(e,r){var t;if(typeof e=="string"){var n=fe().parseFromString('<x-turndown id="turndown-root">'+e+"</x-turndown>","text/html");t=n.getElementById("turndown-root")}else t=e.cloneNode(!0);return ie({element:t,isBlock:y,isVoid:L,isPre:r.preformattedCode?ce:null}),t}var k;function fe(){return k=k||new oe,k}function ce(e){return e.nodeName==="PRE"||e.nodeName==="CODE"}function he(e,r){return e.isBlock=y(e),e.isCode=e.nodeName==="CODE"||e.parentNode.isCode,e.isBlank=de(e),e.flankingWhitespace=pe(e,r),e}function de(e){return!L(e)&&!ee(e)&&/^\s*$/i.test(e.textContent)&&!Z(e)&&!re(e)}function pe(e,r){if(e.isBlock||r.preformattedCode&&e.isCode)return{leading:"",trailing:""};var t=me(e.textContent);return t.leadingAscii&&w("left",e,r)&&(t.leading=t.leadingNonAscii),t.trailingAscii&&w("right",e,r)&&(t.trailing=t.trailingNonAscii),{leading:t.leading,trailing:t.trailing}}function me(e){var r=e.match(/^(([ \t\r\n]*)(\s*))(?:(?=\S)[\s\S]*\S)?((\s*?)([ \t\r\n]*))$/);return{leading:r[1],leadingAscii:r[2],leadingNonAscii:r[3],trailing:r[4],trailingNonAscii:r[5],trailingAscii:r[6]}}function w(e,r,t){var n,i,a;return e==="left"?(n=r.previousSibling,i=/ $/):(n=r.nextSibling,i=/^ /),n&&(n.nodeType===3?a=i.test(n.nodeValue):t.preformattedCode&&n.nodeName==="CODE"?a=!1:n.nodeType===1&&!y(n)&&(a=i.test(n.textContent))),a}var ge=Array.prototype.reduce;function m(e){if(!(this instanceof m))return new m(e);var r={rules:o,headingStyle:"setext",hr:"* * *",bulletListMarker:"*",codeBlockStyle:"indented",fence:"```",emDelimiter:"_",strongDelimiter:"**",linkStyle:"inlined",linkReferenceStyle:"full",br:"  ",preformattedCode:!1,blankReplacement:function(t,n){return n.isBlock?`

`:""},keepReplacement:function(t,n){return n.isBlock?`

`+n.outerHTML+`

`:n.outerHTML},defaultReplacement:function(t,n){return n.isBlock?`

`+t+`

`:t}};this.options=Q({},r,e),this.rules=new H(this.options)}m.prototype={turndown:function(e){if(!ke(e))throw new TypeError(e+" is not a string, or an element/document/fragment node.");if(e==="")return"";var r=F.call(this,new ue(e,this.options));return ve.call(this,r)},use:function(e){if(Array.isArray(e))for(var r=0;r<e.length;r++)this.use(e[r]);else if(typeof e=="function")e(this);else throw new TypeError("plugin must be a Function or an Array of Functions");return this},addRule:function(e,r){return this.rules.add(e,r),this},keep:function(e){return this.rules.keep(e),this},remove:function(e){return this.rules.remove(e),this},escape:function(e){return M(e)}};function F(e){var r=this;return ge.call(e.childNodes,function(t,n){n=new he(n,r.options);var i="";return n.nodeType===3?i=n.isCode?n.nodeValue:r.escape(n.nodeValue):n.nodeType===1&&(i=Ne.call(r,n)),$(t,i)},"")}function ve(e){var r=this;return this.rules.forEach(function(t){typeof t.append=="function"&&(e=$(e,t.append(r.options)))}),e.replace(/^[\t\r\n]+/,"").replace(/[\t\r\n\s]+$/,"")}function Ne(e){var r=this.rules.forNode(e),t=F.call(this,e),n=e.flankingWhitespace;return(n.leading||n.trailing)&&(t=t.trim()),n.leading+r.replacement(t,e,this.options)+n.trailing}function $(e,r){var t=D(e),n=S(r),i=Math.max(e.length-t.length,r.length-n.length),a=`

`.substring(0,i);return t+a+n}function ke(e){return e!=null&&(typeof e=="string"||e.nodeType&&(e.nodeType===1||e.nodeType===9||e.nodeType===11))}V.exports=m});var q=g(c=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var _=/highlight-(?:text|source)-([a-z0-9]+)/;function W(e){e.addRule("highlightedCodeBlock",{filter:function(r){var t=r.firstChild;return r.nodeName==="DIV"&&_.test(r.className)&&t&&t.nodeName==="PRE"},replacement:function(r,t,n){var i=t.className||"",a=(i.match(_)||[null,""])[1];return`

`+n.fence+a+`
`+t.firstChild.textContent+`
`+n.fence+`

`}})}function j(e){e.addRule("strikethrough",{filter:["del","s","strike"],replacement:function(r){return"~"+r+"~"}})}var Ae=Array.prototype.indexOf,ye=Array.prototype.every,h={};h.tableCell={filter:["th","td"],replacement:function(e,r){return G(e,r)}};h.tableRow={filter:"tr",replacement:function(e,r){var t="",n={left:":--",right:"--:",center:":-:"};if(b(r))for(var i=0;i<r.childNodes.length;i++){var a="---",s=(r.childNodes[i].getAttribute("align")||"").toLowerCase();s&&(a=n[s]||a),t+=G(a,r.childNodes[i])}return`
`+e+(t?`
`+t:"")}};h.table={filter:function(e){return e.nodeName==="TABLE"&&b(e.rows[0])},replacement:function(e){return e=e.replace(`

`,`
`),`

`+e+`

`}};h.tableSection={filter:["thead","tbody","tfoot"],replacement:function(e){return e}};function b(e){var r=e.parentNode;return r.nodeName==="THEAD"||r.firstChild===e&&(r.nodeName==="TABLE"||Te(r))&&ye.call(e.childNodes,function(t){return t.nodeName==="TH"})}function Te(e){var r=e.previousSibling;return e.nodeName==="TBODY"&&(!r||r.nodeName==="THEAD"&&/^\s*$/i.test(r.textContent))}function G(e,r){var t=Ae.call(r.parentNode.childNodes,r),n=" ";return t===0&&(n="| "),n+e+" |"}function X(e){e.keep(function(t){return t.nodeName==="TABLE"&&!b(t.rows[0])});for(var r in h)e.addRule(r,h[r])}function Y(e){e.addRule("taskListItems",{filter:function(r){return r.type==="checkbox"&&r.parentNode.nodeName==="LI"},replacement:function(r,t){return(t.checked?"[x]":"[ ]")+" "}})}function Ee(e){e.use([W,j,X,Y])}c.gfm=Ee;c.highlightedCodeBlock=W;c.strikethrough=j;c.tables=X;c.taskListItems=Y});var be=g((De,K)=>{var Ce=U(),{gfm:Re}=q();K.exports={TurndownService:Ce,gfm:Re}});return be();})();

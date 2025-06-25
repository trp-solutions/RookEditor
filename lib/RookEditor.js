/*
RookEditor is licensed under the Apache License 2.0 license
https://github.com/TRP-Solutions/rook-editor/blob/main/LICENSE.txt
*/
function RookEditor(source, root_name, find_special_element, create_special_element){
	function write_xml(){
		write_source(serializer.serializeToString(doc));
	}
	function find_leading_whitespace(elem){
		while(elem && elem.nodeName != '#text'){
			elem = elem.previousSibling;
		}
		if(elem && typeof elem.textContent == 'string'){
			var match = elem.textContent.match('[\t ]*$');
			if(match && match[0]) return match[0];
		}
		return '';
	}
	function create_element(type, parent, extra, insertBefore){
		try{
			var elem = doc.createElement(type)
		} catch(e){
			console.error('Invalid character: ',type);
			var elem = doc.createElement('error');
		}

		if(insertBefore){
			var sibling = insertBefore.parentElement == parent ? insertBefore : parent.firstElementChild;
			insert_element_before(elem, sibling);
		} else {
			append_element(elem, parent);
		}
		
		if(create_special_element[type]) create_special_element[type](elem, extra);

		write_xml();
		return elem;
	}
	function insert_element_before(elem, sibling, preserve_empty_parent){
		if(elem.parentElement){
			remove_element(elem, preserve_empty_parent);
		}
		sibling.before(elem, '\r\n'+find_leading_whitespace(sibling));
	}
	function insert_element_after(elem, sibling, preserve_empty_parent){
		if(elem.parentElement){
			remove_element(elem, preserve_empty_parent);
		}
		sibling.after('\r\n'+find_leading_whitespace(sibling), elem);
	}
	function prepend_element(elem, parent, preserve_empty_parent){
		if(elem.parentElement){
			remove_element(elem, preserve_empty_parent || elem.parentElement == parent);
		}
		var whitespace = find_leading_whitespace(parent);
		if(parent.childNodes.length == 0){
			parent.appendChild(doc.createTextNode('\r\n'+whitespace));
		}
		parent.prepend('\r\n'+whitespace+'\t', elem);
	}
	function append_element(elem, parent, preserve_empty_parent){
		if(elem.parentElement){
			remove_element(elem, preserve_empty_parent || elem.parentElement == parent);
		}
		var whitespace = find_leading_whitespace(parent);
		if(parent.childNodes.length == 0){
			parent.appendChild(doc.createTextNode('\r\n'+whitespace));
		}
		if(parent.lastChild && parent.lastChild.nodeName == '#text'){
			parent.lastChild.textContent += '\t';
		}
		parent.append(elem, '\r\n'+whitespace);
	}
	function remove_element(elem, preserve_empty_parent){
		if(!elem) return;
		var parent = elem.parentElement;
		if(!parent) return;
		if(elem.previousSibling && elem.previousSibling.nodeName == "#text"){
			parent.removeChild(elem.previousSibling);
		}
		parent.removeChild(elem);
		if(parent.children.length == 0 && !preserve_empty_parent) remove_element(parent);
	}
	function find_element(elem, path, do_create){
		elem = elem || doc;
		path = path.split('/');
		for(var i = 0; i < path.length; i++){
			var parent = elem;
			if(!parent) return;
			var path_node = path[i].split(':', 2);
			var type = path_node[0];
			var extra = path_node[1] || undefined;
			if(find_special_element[type]){
				elem = find_special_element[type](parent, extra, do_create);
			} else if(!isNaN(extra) && parent.children.length >= extra){
				elem = parent.children[Number(extra)-1];
			} else {
				elem = parent.querySelector(type);
				if(elem && elem.parentElement && elem.parentElement != parent){
					elem = undefined;
				}
			}
			if(!elem && do_create) elem = create_element(type, parent, extra);
		}
		if(elem != doc) return elem;
	}
	function edit_attr_action(path, xml, attr){
		return function (event){
			edit_attr(event.target.value, path, xml, attr);
			write_xml();
		}
	}
	function edit_attr(value, path, xml, attr){
		if(path != ''){
			elem = find_element(xml, path, value != '');
		} else {
			elem = xml;
		}
		if(elem){
			if(value != '') elem.setAttribute(attr, value);
			else elem.removeAttribute(attr);
		}
	}
	function edit_value_action(path, xml, preserve_empty_parent){
		return function (event){
			edit_value(event.target.value, path, xml);
			write_xml();
		}
	}
	function edit_value(value, path, xml, preserve_empty_parent){
		elem = find_element(xml, path, value != '');
		if(elem){
			if(value != '') elem.textContent = value;
			else remove_element(elem, preserve_empty_parent);
		}
	}
	function checkbox_action(path, xml, preserve_empty_parent){
		return function (event){
			var checked = event.target.checked;
			elem = find_element(xml, path, checked);
			if(elem && !checked) remove_element(elem, preserve_empty_parent);
			write_xml();
		}
	}
	function read_source(){
		if(typeof source.value == 'string'){
			return source.value;
		}
		return source.textContent;
	}
	function write_source(text){
		if(typeof source.value == 'string'){
			source.value = text;
		} else {
			source.textContent = text;
		}
	}
	function write_after(func){
		return function(...arguments){
			var result = func(...arguments);
			write_xml();
			return result;
		}
	}
	var parser = new DOMParser();
	var serializer = new XMLSerializer();
	var source_value = read_source();
	if(source_value == ''){
		write_source('<'+root_name+'></'+root_name+'>');
	}
	var doc = parser.parseFromString(source_value, 'text/xml');
	var root = doc.childNodes[0];
	if(root.nodeName == 'parsererror'){
		throw root.textContent;
	}
	if(root.nodeName != root_name){
		var new_root = doc.createElement(root_name);
		var node = root.firstChild;
		while(node){
			next_node = node.nextSibling;
			new_root.appendChild(node);
			node = next_node;
		}
		for(var i = 0; i < root.attributes.length; i++){
			new_root.setAttribute(root.attributes[i].name, root.attributes[i].value);
		}
		doc.replaceChild(new_root, root);
		write_xml();
		root = new_root;
	}
	if(root.childNodes.length == 0
		|| (root.lastChild
			&& root.lastChild.nodeName == '#text'
			&& root.textContent.match(/^\r\n\t*$/))){
		root.appendChild(doc.createTextNode('\r\n'));
	}
	this.root = root;
	this.create_element = write_after(create_element);
	this.insert_element_before = write_after(insert_element_before);
	this.insert_element_after = write_after(insert_element_after);
	this.prepend_element = write_after(prepend_element);
	this.append_element = write_after(append_element);
	this.remove_element = write_after(remove_element);
	this.find_element = find_element;
	this.edit_attr_action = edit_attr_action;
	this.edit_attr = write_after(edit_attr);
	this.edit_value_action = edit_value_action;
	this.edit_value = write_after(edit_value);
	this.checkbox_action = checkbox_action;
	this.write_xml = write_xml;
}

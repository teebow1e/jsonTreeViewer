/*
 * JSON Tree Viewer
 * http://github.com/summerstyle/jsonTreeViewer
 *
 * Copyright 2017 Vera Lobacheva (http://iamvera.com)
 * Released under the MIT license (LICENSE.txt)
 * 
 * Modified by teebow1e (https://trungtqt.com) and hosted on https://json.đặc.vn.
 */

'use strict';

var jsonTreeViewer = (function() {

    /* Utilities */
    var utils = App.utils;
    
    var treeWrapper = document.getElementById("tree");
    var tree = jsonTree.create({}, treeWrapper);
    
    // Menu
    var menu = new App.Menu(utils.dom.id('nav'), {
        'load' : function() {
            load_json_form.show();
        },
        'expand' : function() {
            tree.expand();
        },
        'collapse' : function() {
            tree.collapse();
        },
        'source' : function() {
            source_json_window.print(
                tree.toSourceJSON('isPrettyPrinted')
            );
        },
        'find_and_mark' : function() {
            find_nodes_form.show();
        },
        'unmark_all' : function() {
            tree.unmarkAll();
        },
        'help' : function() {
            help.show();
        } 
    });


    /* Load json form */
    var load_json_form = new App.Window({
        content_el : utils.dom.id('load_json_form'),
        overlay : true,
        js_module : function(self) {
            var form = self.content_el,
                code_input = document.getElementById('code_input'),
                load_button = document.getElementById('load_code_button');
            
            function load(e) {
                jsonTreeViewer.parse(code_input.value);
                self.hide();
                code_input.value = '';
            
                e.preventDefault();
            }
            
            load_button.addEventListener('click', load, false);
        }
    });
    
    
    /* Help block */
    var help = new App.Window({
        content_el : document.getElementById('help'),
        overlay : true
    });

    /* Block for source JSON */
    var source_json_window = new App.Window({
        content_el : utils.dom.id('source_json'),
        overlay : true,
        js_module : function(self) {
            return {
                print: function(str) {
                    self.content_el.innerHTML = str;
                    self.show();
                }
            };
        }
    });

    /* Find nodes form */
    var find_nodes_form = new App.Window({
        content_el : utils.dom.id('find_nodes_form'),
        overlay : true,
        js_module : function(self) {
            var form = self.content_el,
                search_type_radio = {
                    label_name : document.getElementById('nodes_search_by_label'),
                    node_type : document.getElementById('nodes_search_by_type')
                },
                label_name_input = document.getElementById('search_by_label_name'),
                node_types_checkboxes = document.getElementsByName('nodes_type'),
                find_button = document.getElementById('find_button'),
                MATCHERS = {
                    BY_LABEL_NAME : function(labelName, node) {
                        return node.label === labelName;
                    },
                    BY_NODE_TYPE : function(nodeTypesArray, node) {
                        return nodeTypesArray.indexOf(node.type) >= 0;
                    }
                };

            function find(e) {
                var matcher;

                e.preventDefault();

                if (search_type_radio.label_name.checked) {
                    var label_name_value = label_name_input.value.trim();

                    if (!label_name_value) {
                        return;
                    }
                    matcher = MATCHERS.BY_LABEL_NAME.bind(null, label_name_value);
                } else if (search_type_radio.node_type.checked) {
                    var node_type_values = [];

                    for (var i = 0, c = node_types_checkboxes.length; i < c; i++) {
                        if (node_types_checkboxes[i].checked) {
                            node_type_values.push(node_types_checkboxes[i].value);
                        }
                    }

                    if (!node_type_values.length) {
                        return;
                    }

                    matcher = MATCHERS.BY_NODE_TYPE.bind(null, node_type_values);
                }

                if (!matcher) {
                    return;
                }

                tree.findAndHandle(matcher, function(node) {
                    node.mark();
                    node.expandParent('isRecursive');
                });

                self.hide();
            }
            
            find_button.addEventListener('click', find, false);
        }
    });

    load_json_form.show();
    
    var MODES = { STRICT: 0, LENIENT: 1, REPAIRED: 2 };

    function setParseMode(mode) {
        var el = document.getElementById('lenient_indicator');
        if (!el) return;
        if (mode === MODES.STRICT) {
            el.style.display = 'none';
        } else if (mode === MODES.LENIENT) {
            el.style.display = 'inline-block';
            el.textContent = 'lenient mode';
            el.style.background = '#fff4d6';
            el.style.color = '#7a5300';
            el.style.borderColor = '#e8c87a';
            el.title = 'Strict JSON.parse failed; JSON5 (lenient grammar) parsed it.';
        } else if (mode === MODES.REPAIRED) {
            el.style.display = 'inline-block';
            el.textContent = 'repaired';
            el.style.background = '#ffe2e2';
            el.style.color = '#8a1f1f';
            el.style.borderColor = '#f1a8a8';
            el.title = 'Input was structurally broken (missing commas, unclosed strings/braces, etc.). jsonrepair reconstructed a best-guess valid JSON before rendering.';
        }
    }

    function tryRepair(json_str) {
        if (typeof JSONRepair === 'undefined' || !JSONRepair.jsonrepair) return undefined;
        var repaired = JSONRepair.jsonrepair(json_str);
        return JSON.parse(repaired);
    }

    return {
        parse : function(json_str) {
            var temp, errs = {};

            try {
                temp = JSON.parse(json_str);
                setParseMode(MODES.STRICT);
            } catch (e1) {
                errs.strict = e1.message;
                try {
                    if (typeof JSON5 === 'undefined') throw new Error('JSON5 not loaded');
                    temp = JSON5.parse(json_str);
                    setParseMode(MODES.LENIENT);
                } catch (e2) {
                    errs.lenient = e2.message;
                    try {
                        temp = tryRepair(json_str);
                        if (typeof temp === 'undefined') throw new Error('jsonrepair not loaded');
                        setParseMode(MODES.REPAIRED);
                    } catch (e3) {
                        errs.repair = e3.message;
                        alert('Could not parse JSON.\n\n' +
                              'Strict:    ' + errs.strict + '\n' +
                              'Lenient:   ' + errs.lenient + '\n' +
                              'Repair:    ' + errs.repair);
                        return;
                    }
                }
            }

            if (typeof temp === 'undefined') return;
            tree.loadData(temp);
        }
    };
})();

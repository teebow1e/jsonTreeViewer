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
    var sourceJSONObj = {};
    
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
        'filter_fields' : function() {
            filter_fields_form.show();
        },
        'clear_filter' : function() {
            tree.loadData(sourceJSONObj);
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

    /* Filter fields form */
    var filter_fields_form = new App.Window({
        content_el : utils.dom.id('filter_fields_form'),
        overlay : true,
        js_module : function(self) {
            var field_filter_options = document.getElementById('field_filter_options'),
                filter_fields_button = document.getElementById('filter_fields_button');

            var originalShow = self.show;
            self.show = function() {
                renderFieldOptions(field_filter_options, sourceJSONObj);
                originalShow.call(self);
            };

            function filter(e) {
                var filter_value = getSelectedFieldSelectors(field_filter_options),
                    filtered;

                e.preventDefault();

                if (!filter_value) {
                    return;
                }

                try {
                    filtered = projectFields(sourceJSONObj, filter_value);
                } catch (err) {
                    alert(err.message);
                    return;
                }

                tree.loadData(filtered);
                self.hide();
            }

            filter_fields_button.addEventListener('click', filter, false);
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

    function renderFieldOptions(container, data) {
        var paths = uniquePaths(getFieldPaths(data, '', [], true)), html = '';

        if (!paths.length) {
            container.innerHTML = '<span class="form__hint">No selectable fields found.</span>';
            return;
        }

        paths.forEach(function(path) {
            html += '<label><input type="checkbox" name="field_filter" value="' + escapeHTML(path) + '" />' + escapeHTML(path) + '</label>';
        });

        container.innerHTML = html;
    }

    function getFieldPaths(value, prefix, paths, isRoot) {
        var valueType = Object.prototype.toString.call(value), keys;

        if (valueType === '[object Array]') {
            if (!value.length) {
                if (prefix) paths.push(prefix);
                return paths;
            }

            value.forEach(function(item) {
                getFieldPaths(item, prefix + (isRoot ? '' : '[]'), paths, false);
            });
            return paths;
        }

        if (value !== null && valueType === '[object Object]') {
            keys = Object.keys(value);
            if (!keys.length) {
                if (prefix) paths.push(prefix);
                return paths;
            }

            keys.forEach(function(key) {
                getFieldPaths(value[key], prefix + formatPathKey(key), paths, false);
            });
            return paths;
        }

        if (prefix) paths.push(prefix);
        return paths;
    }

    function uniquePaths(paths) {
        var seen = {}, result = [];

        paths.forEach(function(path) {
            if (!seen[path]) {
                seen[path] = true;
                result.push(path);
            }
        });

        return result;
    }

    function formatPathKey(key) {
        if (/^[A-Za-z_$][\w$]*$/.test(key)) {
            return '.' + key;
        }

        return '[' + JSON.stringify(key) + ']';
    }

    function getSelectedFieldSelectors(container) {
        var checkboxes = container.querySelectorAll('input[name="field_filter"]:checked'),
            selectors = [];

        for (var i = 0; i < checkboxes.length; i++) {
            selectors.push(checkboxes[i].value);
        }

        return selectors.join(', ');
    }

    function escapeHTML(str) {
        return String(str).replace(/[&<>"']/g, function(ch) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[ch];
        });
    }

    function projectFields(data, query) {
        var selectors = parseFieldSelectors(query),
            rootIsArray = Object.prototype.toString.call(data) === '[object Array]',
            result = rootIsArray ? [] : {};

        if (!selectors.length) {
            throw new Error('Enter at least one field selector.');
        }

        selectors.forEach(function(selector) {
            applySelector(result, data, selector, rootIsArray);
        });

        return result;
    }

    function parseFieldSelectors(query) {
        return splitSelectors(query).map(function(selector) {
            return parsePath(selector.trim());
        }).filter(function(path) {
            return path.length;
        });
    }

    function splitSelectors(query) {
        var selectors = [],
            current = '',
            quote = null,
            bracketDepth = 0;

        for (var i = 0; i < query.length; i++) {
            var ch = query.charAt(i),
                prev = query.charAt(i - 1);

            if (quote) {
                current += ch;
                if (ch === quote && prev !== '\\') quote = null;
                continue;
            }

            if (ch === '"' || ch === "'") {
                quote = ch;
                current += ch;
            } else if (ch === '[') {
                bracketDepth++;
                current += ch;
            } else if (ch === ']') {
                bracketDepth--;
                current += ch;
            } else if (ch === ',' && bracketDepth === 0) {
                selectors.push(current);
                current = '';
            } else {
                current += ch;
            }
        }

        selectors.push(current);
        return selectors;
    }

    function parsePath(selector) {
        var path = [], i = 0;

        if (selector.charAt(0) === '.') i = 1;

        while (i < selector.length) {
            var ch = selector.charAt(i);

            if (ch === '.') {
                i++;
                continue;
            }

            if (ch === '[') {
                var close = selector.indexOf(']', i), token;
                if (close < 0) throw new Error('Invalid selector: ' + selector);

                token = selector.substring(i + 1, close).trim();
                if (token === '') {
                    path.push({ type: 'wildcard' });
                } else if (/^\d+$/.test(token)) {
                    path.push({ type: 'index', key: parseInt(token, 10) });
                } else if ((token.charAt(0) === '"' && token.charAt(token.length - 1) === '"') ||
                           (token.charAt(0) === "'" && token.charAt(token.length - 1) === "'")) {
                    path.push({ type: 'key', key: token.substring(1, token.length - 1) });
                } else {
                    throw new Error('Invalid selector: ' + selector);
                }
                i = close + 1;
                continue;
            }

            var start = i;
            while (i < selector.length && selector.charAt(i) !== '.' && selector.charAt(i) !== '[') i++;
            path.push({ type: 'key', key: selector.substring(start, i) });
        }

        return path;
    }

    function applySelector(result, data, path, rootIsArray) {
        if (rootIsArray) {
            data.forEach(function(item, index) {
                if (!result[index]) result[index] = {};
                copyPath(result[index], item, path, 0);
            });
        } else {
            copyPath(result, data, path, 0);
        }
    }

    function copyPath(target, source, path, depth) {
        if (source === null || typeof source === 'undefined' || depth >= path.length) return;

        var part = path[depth], value;

        if (part.type === 'wildcard') {
            if (Object.prototype.toString.call(source) !== '[object Array]') return;
            source.forEach(function(item, index) {
                if (depth === path.length - 1) {
                    target[index] = item;
                    return;
                }

                if (!target[index]) target[index] = {};
                copyPath(target[index], item, path, depth + 1);
            });
            return;
        }

        value = source[part.key];
        if (typeof value === 'undefined') return;

        if (depth === path.length - 1) {
            target[part.key] = value;
            return;
        }

        if (path[depth + 1].type === 'wildcard') {
            target[part.key] = [];
        } else if (!target[part.key] || typeof target[part.key] !== 'object') {
            target[part.key] = {};
        }

        copyPath(target[part.key], value, path, depth + 1);
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
            sourceJSONObj = temp;
            tree.loadData(temp);
        }
    };
})();

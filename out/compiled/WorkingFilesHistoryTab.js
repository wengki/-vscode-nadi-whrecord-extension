var app = (function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    /* webviews/components/WorkingFilesHistoryTab.svelte generated by Svelte v3.49.0 */

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    // (39:0) {#if targetFolderData && targetFolderData.hasOwnProperty("date")}
    function create_if_block_7(ctx) {
    	let h3;

    	return {
    		c() {
    			h3 = element("h3");
    			h3.textContent = `${targetFolderData.date}`;
    		},
    		m(target, anchor) {
    			insert(target, h3, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(h3);
    		}
    	};
    }

    // (75:0) {:else}
    function create_else_block(ctx) {
    	let ul;
    	let each_value_1 = /*projectFileHistory*/ ctx[1];
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	return {
    		c() {
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr(ul, "class", "history-list");
    		},
    		m(target, anchor) {
    			insert(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*historyCollections, projectFileHistory, getDateHour, nadivscode, Object*/ 7) {
    				each_value_1 = /*projectFileHistory*/ ctx[1];
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    // (42:0) {#if targetFolderData && targetFolderData.hasOwnProperty("date") && targetFolderData.hasOwnProperty("key")}
    function create_if_block(ctx) {
    	let ul;
    	let each_value = /*projectFileHistory*/ ctx[1][targetFolderData.key];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c() {
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr(ul, "class", "history-list-collection");
    		},
    		m(target, anchor) {
    			insert(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*getDateHour, projectFileHistory, targetFolderData, nadivscode, Object*/ 6) {
    				each_value = /*projectFileHistory*/ ctx[1][targetFolderData.key];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    // (88:8) {#if historyCollections && historyCollections.hasOwnProperty(historyDate.dirname)}
    function create_if_block_3(ctx) {
    	let if_block_anchor;

    	function select_block_type_1(ctx, dirty) {
    		if (/*historyCollections*/ ctx[0][/*historyDate*/ ctx[9].dirname].length > 0) return create_if_block_4;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (122:10) {:else}
    function create_else_block_1(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");
    			div.textContent = "There is no history of changes to the project.";
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (89:10) {#if historyCollections[historyDate.dirname].length > 0}
    function create_if_block_4(ctx) {
    	let ul;
    	let each_value_2 = /*historyCollections*/ ctx[0][/*historyDate*/ ctx[9].dirname];
    	let each_blocks = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	return {
    		c() {
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr(ul, "class", "history-list-collection");
    		},
    		m(target, anchor) {
    			insert(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*getDateHour, historyCollections, projectFileHistory, nadivscode, Object*/ 7) {
    				each_value_2 = /*historyCollections*/ ctx[0][/*historyDate*/ ctx[9].dirname];
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_2.length;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    // (107:22) {#if item && item.hasOwnProperty("rename")}
    function create_if_block_6(ctx) {
    	let span;
    	let t0_value = /*getDateHour*/ ctx[2](/*item*/ ctx[6].rename) + "";
    	let t0;
    	let t1;

    	return {
    		c() {
    			span = element("span");
    			t0 = text(t0_value);
    			t1 = text(" -> new/rename");
    			attr(span, "class", "info-rename");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			append(span, t0);
    			append(span, t1);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*historyCollections*/ 1 && t0_value !== (t0_value = /*getDateHour*/ ctx[2](/*item*/ ctx[6].rename) + "")) set_data(t0, t0_value);
    		},
    		d(detaching) {
    			if (detaching) detach(span);
    		}
    	};
    }

    // (112:22) {#if item && item.hasOwnProperty("change")}
    function create_if_block_5(ctx) {
    	let span;
    	let t0_value = /*getDateHour*/ ctx[2](/*item*/ ctx[6].change) + "";
    	let t0;
    	let t1;

    	return {
    		c() {
    			span = element("span");
    			t0 = text(t0_value);
    			t1 = text(" -> last change");
    			attr(span, "class", "info-change");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			append(span, t0);
    			append(span, t1);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*historyCollections*/ 1 && t0_value !== (t0_value = /*getDateHour*/ ctx[2](/*item*/ ctx[6].change) + "")) set_data(t0, t0_value);
    		},
    		d(detaching) {
    			if (detaching) detach(span);
    		}
    	};
    }

    // (91:14) {#each historyCollections[historyDate.dirname] as item}
    function create_each_block_2(ctx) {
    	let li;
    	let span;
    	let t0_value = /*item*/ ctx[6].rpath + "";
    	let t0;
    	let t1;
    	let div;
    	let small;
    	let show_if_1 = /*item*/ ctx[6] && /*item*/ ctx[6].hasOwnProperty("rename");
    	let t2;
    	let show_if = /*item*/ ctx[6] && /*item*/ ctx[6].hasOwnProperty("change");
    	let t3;
    	let mounted;
    	let dispose;

    	function click_handler_2() {
    		return /*click_handler_2*/ ctx[5](/*item*/ ctx[6], /*historyDate*/ ctx[9]);
    	}

    	let if_block0 = show_if_1 && create_if_block_6(ctx);
    	let if_block1 = show_if && create_if_block_5(ctx);

    	return {
    		c() {
    			li = element("li");
    			span = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			div = element("div");
    			small = element("small");
    			if (if_block0) if_block0.c();
    			t2 = space();
    			if (if_block1) if_block1.c();
    			t3 = space();
    			attr(span, "class", "info-path");
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, span);
    			append(span, t0);
    			append(li, t1);
    			append(li, div);
    			append(div, small);
    			if (if_block0) if_block0.m(small, null);
    			append(small, t2);
    			if (if_block1) if_block1.m(small, null);
    			append(li, t3);

    			if (!mounted) {
    				dispose = listen(span, "click", click_handler_2);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*historyCollections*/ 1 && t0_value !== (t0_value = /*item*/ ctx[6].rpath + "")) set_data(t0, t0_value);
    			if (dirty & /*historyCollections*/ 1) show_if_1 = /*item*/ ctx[6] && /*item*/ ctx[6].hasOwnProperty("rename");

    			if (show_if_1) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_6(ctx);
    					if_block0.c();
    					if_block0.m(small, t2);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (dirty & /*historyCollections*/ 1) show_if = /*item*/ ctx[6] && /*item*/ ctx[6].hasOwnProperty("change");

    			if (show_if) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_5(ctx);
    					if_block1.c();
    					if_block1.m(small, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (77:4) {#each projectFileHistory as historyDate}
    function create_each_block_1(ctx) {
    	let li;
    	let span;
    	let t0_value = /*historyDate*/ ctx[9].text + "";
    	let t0;
    	let t1;
    	let show_if = /*historyCollections*/ ctx[0] && /*historyCollections*/ ctx[0].hasOwnProperty(/*historyDate*/ ctx[9].dirname);
    	let t2;
    	let mounted;
    	let dispose;

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[4](/*historyDate*/ ctx[9]);
    	}

    	let if_block = show_if && create_if_block_3(ctx);

    	return {
    		c() {
    			li = element("li");
    			span = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			if (if_block) if_block.c();
    			t2 = space();
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, span);
    			append(span, t0);
    			append(li, t1);
    			if (if_block) if_block.m(li, null);
    			append(li, t2);

    			if (!mounted) {
    				dispose = listen(span, "click", click_handler_1);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*historyCollections*/ 1) show_if = /*historyCollections*/ ctx[0] && /*historyCollections*/ ctx[0].hasOwnProperty(/*historyDate*/ ctx[9].dirname);

    			if (show_if) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_3(ctx);
    					if_block.c();
    					if_block.m(li, t2);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    			if (if_block) if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (60:12) {#if item && item.hasOwnProperty("rename")}
    function create_if_block_2(ctx) {
    	let span;
    	let t0_value = /*getDateHour*/ ctx[2](/*item*/ ctx[6].rename) + "";
    	let t0;
    	let t1;

    	return {
    		c() {
    			span = element("span");
    			t0 = text(t0_value);
    			t1 = text(" -> new/rename");
    			attr(span, "class", "info-rename");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			append(span, t0);
    			append(span, t1);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(span);
    		}
    	};
    }

    // (65:12) {#if item && item.hasOwnProperty("change")}
    function create_if_block_1(ctx) {
    	let span;
    	let t0_value = /*getDateHour*/ ctx[2](/*item*/ ctx[6].change) + "";
    	let t0;
    	let t1;

    	return {
    		c() {
    			span = element("span");
    			t0 = text(t0_value);
    			t1 = text(" -> last change");
    			attr(span, "class", "info-change");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			append(span, t0);
    			append(span, t1);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(span);
    		}
    	};
    }

    // (44:4) {#each projectFileHistory[targetFolderData.key] as item}
    function create_each_block(ctx) {
    	let li;
    	let span;
    	let t0_value = /*item*/ ctx[6].rpath + "";
    	let t0;
    	let t1;
    	let div;
    	let small;
    	let show_if_1 = /*item*/ ctx[6] && /*item*/ ctx[6].hasOwnProperty("rename");
    	let t2;
    	let show_if = /*item*/ ctx[6] && /*item*/ ctx[6].hasOwnProperty("change");
    	let t3;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[3](/*item*/ ctx[6]);
    	}

    	let if_block0 = show_if_1 && create_if_block_2(ctx);
    	let if_block1 = show_if && create_if_block_1(ctx);

    	return {
    		c() {
    			li = element("li");
    			span = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			div = element("div");
    			small = element("small");
    			if (if_block0) if_block0.c();
    			t2 = space();
    			if (if_block1) if_block1.c();
    			t3 = space();
    			attr(span, "class", "info-path");
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, span);
    			append(span, t0);
    			append(li, t1);
    			append(li, div);
    			append(div, small);
    			if (if_block0) if_block0.m(small, null);
    			append(small, t2);
    			if (if_block1) if_block1.m(small, null);
    			append(li, t3);

    			if (!mounted) {
    				dispose = listen(span, "click", click_handler);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (show_if_1) if_block0.p(ctx, dirty);
    			if (show_if) if_block1.p(ctx, dirty);
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function create_fragment(ctx) {
    	let h2;
    	let t1;
    	let show_if_1 = targetFolderData && targetFolderData.hasOwnProperty("date");
    	let t2;
    	let if_block1_anchor;
    	let if_block0 = show_if_1 && create_if_block_7();

    	function select_block_type(ctx, dirty) {
    		if (targetFolderData && targetFolderData.hasOwnProperty("date") && targetFolderData.hasOwnProperty("key")) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type();
    	let if_block1 = current_block_type(ctx);

    	return {
    		c() {
    			h2 = element("h2");
    			h2.textContent = "Working File History";
    			t1 = space();
    			if (if_block0) if_block0.c();
    			t2 = space();
    			if_block1.c();
    			if_block1_anchor = empty();
    		},
    		m(target, anchor) {
    			insert(target, h2, anchor);
    			insert(target, t1, anchor);
    			if (if_block0) if_block0.m(target, anchor);
    			insert(target, t2, anchor);
    			if_block1.m(target, anchor);
    			insert(target, if_block1_anchor, anchor);
    		},
    		p(ctx, [dirty]) {
    			if (show_if_1) if_block0.p(ctx, dirty);
    			if_block1.p(ctx, dirty);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(h2);
    			if (detaching) detach(t1);
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach(t2);
    			if_block1.d(detaching);
    			if (detaching) detach(if_block1_anchor);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let projectFileHistory = workFilesHistory;
    	let historyCollections = {};

    	let getDateHour = time => {
    		var month = [
    			"Jan",
    			"Feb",
    			"Mar",
    			"Apr",
    			"May",
    			"Jun",
    			"Jul",
    			"Aug",
    			"Sep",
    			"Oct",
    			"Nov",
    			"Dec"
    		];

    		const dirnameToDate = new Date(time);
    		var dd = String(dirnameToDate.getDate()).padStart(2, "0");
    		var mmm = month[dirnameToDate.getMonth()];
    		var yyyy = dirnameToDate.getFullYear();
    		return `${mmm} ${dd}, ${yyyy} ${String(dirnameToDate.getHours()).padStart(2, "0")}:${String(dirnameToDate.getMinutes()).padStart(2, "0")}`;
    	};

    	onMount(() => {
    		window.addEventListener("message", event => {
    			switch (event.data.type) {
    				case "receiveHistoryCollections":
    					$$invalidate(0, historyCollections = Object.assign(historyCollections, event.data.value));
    					break;
    			}
    		});
    	});

    	const click_handler = item => {
    		nadivscode.postMessage({
    			type: "seeHistoryFileDiff",
    			value: Object.assign(item, { dirname: targetFolderData.key })
    		});
    	};

    	const click_handler_1 = historyDate => {
    		nadivscode.postMessage({
    			type: "getHistoryCollections",
    			value: historyDate.path
    		});
    	};

    	const click_handler_2 = (item, historyDate) => {
    		nadivscode.postMessage({
    			type: "seeHistoryFileDiff",
    			value: Object.assign(item, { dirname: historyDate.dirname })
    		});
    	};

    	return [
    		historyCollections,
    		projectFileHistory,
    		getDateHour,
    		click_handler,
    		click_handler_1,
    		click_handler_2
    	];
    }

    class WorkingFilesHistoryTab extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    const app = new WorkingFilesHistoryTab({
        target: document.body
    });

    return app;

})();
//# sourceMappingURL=WorkingFilesHistoryTab.js.map

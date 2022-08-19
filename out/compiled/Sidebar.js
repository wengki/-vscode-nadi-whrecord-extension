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
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
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
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
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
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
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

    /* webviews/components/Setting.svelte generated by Svelte v3.49.0 */

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i];
    	return child_ctx;
    }

    // (23:4) {#each historyIgnoreList as item}
    function create_each_block$1(ctx) {
    	let li;
    	let div0;
    	let t0_value = /*item*/ ctx[7] + "";
    	let t0;
    	let t1;
    	let div1;
    	let label;
    	let input;
    	let input_checked_value;
    	let t2;
    	let span;
    	let t3;
    	let mounted;
    	let dispose;

    	function change_handler() {
    		return /*change_handler*/ ctx[3](/*item*/ ctx[7]);
    	}

    	return {
    		c() {
    			li = element("li");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div1 = element("div");
    			label = element("label");
    			input = element("input");
    			t2 = space();
    			span = element("span");
    			t3 = space();
    			attr(div0, "class", "title");
    			attr(div0, "title", /*item*/ ctx[7]);
    			attr(input, "type", "checkbox");

    			input.checked = input_checked_value = /*cancelRemoveHistoryIgnoreItem*/ ctx[1] != /*item*/ ctx[7]
    			? true
    			: false;

    			attr(span, "class", "slider round");
    			attr(label, "class", "switch");
    			attr(div1, "class", "del-button");
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, div0);
    			append(div0, t0);
    			append(li, t1);
    			append(li, div1);
    			append(div1, label);
    			append(label, input);
    			append(label, t2);
    			append(label, span);
    			append(li, t3);

    			if (!mounted) {
    				dispose = listen(input, "change", change_handler);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*cancelRemoveHistoryIgnoreItem*/ 2 && input_checked_value !== (input_checked_value = /*cancelRemoveHistoryIgnoreItem*/ ctx[1] != /*item*/ ctx[7]
    			? true
    			: false)) {
    				input.checked = input_checked_value;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	let div0;
    	let ul;
    	let div0_class_value;
    	let t0;
    	let div3;
    	let div1;
    	let span0;
    	let t2;
    	let span1;
    	let t4;
    	let div2;
    	let span2;
    	let mounted;
    	let dispose;
    	let each_value = /*historyIgnoreList*/ ctx[2];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	return {
    		c() {
    			div0 = element("div");
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t0 = space();
    			div3 = element("div");
    			div1 = element("div");
    			span0 = element("span");
    			span0.textContent = "Dev Tool";
    			t2 = space();
    			span1 = element("span");
    			span1.textContent = "Reload";
    			t4 = space();
    			div2 = element("div");
    			span2 = element("span");
    			span2.textContent = "History Ignore";
    			attr(div0, "class", div0_class_value = "pop-box bottom right historyIgnoreList " + (/*historyIgnorePopOpen*/ ctx[0] ? 'show' : 'hide'));
    			attr(span0, "class", "clickable");
    			attr(span1, "class", "clickable");
    			attr(div1, "class", "left");
    			attr(span2, "class", "clickable");
    			attr(div2, "class", "right");
    			attr(div3, "class", "sidebar-panel-bottom");
    		},
    		m(target, anchor) {
    			insert(target, div0, anchor);
    			append(div0, ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			insert(target, t0, anchor);
    			insert(target, div3, anchor);
    			append(div3, div1);
    			append(div1, span0);
    			append(div1, t2);
    			append(div1, span1);
    			append(div3, t4);
    			append(div3, div2);
    			append(div2, span2);

    			if (!mounted) {
    				dispose = [
    					listen(span0, "click", /*click_handler*/ ctx[4]),
    					listen(span1, "click", /*click_handler_1*/ ctx[5]),
    					listen(span2, "click", /*click_handler_2*/ ctx[6])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*cancelRemoveHistoryIgnoreItem, historyIgnoreList, nadivscode*/ 6) {
    				each_value = /*historyIgnoreList*/ ctx[2];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*historyIgnorePopOpen*/ 1 && div0_class_value !== (div0_class_value = "pop-box bottom right historyIgnoreList " + (/*historyIgnorePopOpen*/ ctx[0] ? 'show' : 'hide'))) {
    				attr(div0, "class", div0_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div0);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(t0);
    			if (detaching) detach(div3);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let historyIgnoreList = settings.historyIgnore;
    	let historyIgnorePopOpen = false;
    	let cancelRemoveHistoryIgnoreItem = '';

    	onMount(() => {
    		window.addEventListener("message", event => {
    			switch (event.data.type) {
    				case 'settingHistoryIgnoreCANCELRemoveItem':
    					{
    						$$invalidate(1, cancelRemoveHistoryIgnoreItem = '');
    						break;
    					}
    			}
    		});
    	});

    	const change_handler = item => {
    		$$invalidate(1, cancelRemoveHistoryIgnoreItem = item);

    		nadivscode.postMessage({
    			type: "settingHistoryIgnoreRemoveItem",
    			value: item
    		});
    	};

    	const click_handler = () => {
    		nadivscode.postMessage({ type: "onRunDeveloperTool", value: null });
    	};

    	const click_handler_1 = () => {
    		nadivscode.postMessage({ type: "onReloadWindow", value: null });
    	};

    	const click_handler_2 = () => {
    		$$invalidate(0, historyIgnorePopOpen = historyIgnorePopOpen ? false : true);
    	};

    	return [
    		historyIgnorePopOpen,
    		cancelRemoveHistoryIgnoreItem,
    		historyIgnoreList,
    		change_handler,
    		click_handler,
    		click_handler_1,
    		click_handler_2
    	];
    }

    class Setting extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});
    	}
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const setting = writable('Initial');

    /* webviews/components/Sidebar.svelte generated by Svelte v3.49.0 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i][0];
    	child_ctx[7] = list[i][1];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	return child_ctx;
    }

    // (38:4) {#if value.text != undefined || !isNaN(value.count)}
    function create_if_block(ctx) {
    	let li;
    	let div;
    	let t0_value = /*value*/ ctx[7].text + "";
    	let t0;
    	let t1;
    	let span;
    	let t2_value = /*value*/ ctx[7].count + "";
    	let t2;
    	let t3;
    	let show_if = /*value*/ ctx[7] && /*value*/ ctx[7].hasOwnProperty("list");
    	let t4;
    	let mounted;
    	let dispose;
    	let if_block = show_if && create_if_block_1(ctx);

    	function click_handler_2() {
    		return /*click_handler_2*/ ctx[4](/*key*/ ctx[6]);
    	}

    	return {
    		c() {
    			li = element("li");
    			div = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			span = element("span");
    			t2 = text(t2_value);
    			t3 = space();
    			if (if_block) if_block.c();
    			t4 = space();
    			attr(span, "class", "badge");
    			attr(div, "class", "title");
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, div);
    			append(div, t0);
    			append(div, t1);
    			append(div, span);
    			append(span, t2);
    			append(li, t3);
    			if (if_block) if_block.m(li, null);
    			append(li, t4);

    			if (!mounted) {
    				dispose = listen(li, "click", click_handler_2);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*historyList*/ 1 && t0_value !== (t0_value = /*value*/ ctx[7].text + "")) set_data(t0, t0_value);
    			if (dirty & /*historyList*/ 1 && t2_value !== (t2_value = /*value*/ ctx[7].count + "")) set_data(t2, t2_value);
    			if (dirty & /*historyList*/ 1) show_if = /*value*/ ctx[7] && /*value*/ ctx[7].hasOwnProperty("list");

    			if (show_if) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					if_block.m(li, t4);
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

    // (50:6) {#if value && value.hasOwnProperty("list")}
    function create_if_block_1(ctx) {
    	let ul;
    	let each_value_1 = /*value*/ ctx[7].list;
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

    			attr(ul, "class", "sidebar-history-item-list");
    		},
    		m(target, anchor) {
    			insert(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*nadivscode, Object, historyList, parseInt*/ 1) {
    				each_value_1 = /*value*/ ctx[7].list;
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

    // (65:16) {:else}
    function create_else_block(ctx) {
    	let small;

    	return {
    		c() {
    			small = element("small");
    			small.textContent = "No files changed";
    			attr(small, "class", "italic gray");
    		},
    		m(target, anchor) {
    			insert(target, small, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(small);
    		}
    	};
    }

    // (63:16) {#if parseInt(item.count) > 0}
    function create_if_block_2(ctx) {
    	let span;
    	let t_value = /*item*/ ctx[10].count + "";
    	let t;

    	return {
    		c() {
    			span = element("span");
    			t = text(t_value);
    			attr(span, "class", "badge");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			append(span, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*historyList*/ 1 && t_value !== (t_value = /*item*/ ctx[10].count + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(span);
    		}
    	};
    }

    // (52:10) {#each value.list as item}
    function create_each_block_1(ctx) {
    	let li;
    	let div;
    	let t0_value = /*item*/ ctx[10].text + "";
    	let t0;
    	let t1;
    	let show_if;
    	let t2;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (dirty & /*historyList*/ 1) show_if = null;
    		if (show_if == null) show_if = !!(parseInt(/*item*/ ctx[10].count) > 0);
    		if (show_if) return create_if_block_2;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx, -1);
    	let if_block = current_block_type(ctx);

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[3](/*item*/ ctx[10]);
    	}

    	return {
    		c() {
    			li = element("li");
    			div = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			if_block.c();
    			t2 = space();
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, div);
    			append(div, t0);
    			append(div, t1);
    			if_block.m(div, null);
    			append(li, t2);

    			if (!mounted) {
    				dispose = listen(div, "click", click_handler_1);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*historyList*/ 1 && t0_value !== (t0_value = /*item*/ ctx[10].text + "")) set_data(t0, t0_value);

    			if (current_block_type === (current_block_type = select_block_type(ctx, dirty)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, null);
    				}
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    			if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (37:2) {#each Object.entries(historyList) as [key, value]}
    function create_each_block(ctx) {
    	let show_if = /*value*/ ctx[7].text != undefined || !isNaN(/*value*/ ctx[7].count);
    	let if_block_anchor;
    	let if_block = show_if && create_if_block(ctx);

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*historyList*/ 1) show_if = /*value*/ ctx[7].text != undefined || !isNaN(/*value*/ ctx[7].count);

    			if (show_if) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let button;
    	let t1;
    	let h4;
    	let t3;
    	let div;
    	let ul;
    	let t4;
    	let child;
    	let updating_value;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = Object.entries(/*historyList*/ ctx[0]);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	function child_value_binding(value) {
    		/*child_value_binding*/ ctx[5](value);
    	}

    	let child_props = {};

    	if (/*$setting*/ ctx[1] !== void 0) {
    		child_props.value = /*$setting*/ ctx[1];
    	}

    	child = new Setting({ props: child_props });
    	binding_callbacks.push(() => bind(child, 'value', child_value_binding));

    	return {
    		c() {
    			button = element("button");
    			button.textContent = "All History By Date";
    			t1 = space();
    			h4 = element("h4");
    			h4.innerHTML = `<b>Work History</b>`;
    			t3 = space();
    			div = element("div");
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t4 = space();
    			create_component(child.$$.fragment);
    			attr(ul, "class", "sidebar-history-list");
    			attr(div, "class", "sidebar-history-box");
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);
    			insert(target, t1, anchor);
    			insert(target, h4, anchor);
    			insert(target, t3, anchor);
    			insert(target, div, anchor);
    			append(div, ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			insert(target, t4, anchor);
    			mount_component(child, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen(button, "click", /*click_handler*/ ctx[2]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*nadivscode, Object, historyList, parseInt, undefined, isNaN*/ 1) {
    				each_value = Object.entries(/*historyList*/ ctx[0]);
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

    			const child_changes = {};

    			if (!updating_value && dirty & /*$setting*/ 2) {
    				updating_value = true;
    				child_changes.value = /*$setting*/ ctx[1];
    				add_flush_callback(() => updating_value = false);
    			}

    			child.$set(child_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(child.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(child.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			if (detaching) detach(t1);
    			if (detaching) detach(h4);
    			if (detaching) detach(t3);
    			if (detaching) detach(div);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(t4);
    			destroy_component(child, detaching);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let $setting;
    	component_subscribe($$self, setting, $$value => $$invalidate(1, $setting = $$value));
    	let historyList = initHistoryList;

    	onMount(() => {
    		window.addEventListener("message", event => {
    			const message = event.data;

    			switch (message.type) {
    				case "onHistoryChange":
    					// historyList = [{ text: message.value, completed: false }, ...historyList];
    					break;
    				case "getHistoryOfMonth":
    					if (historyList && historyList.hasOwnProperty(message.value.key)) {
    						$$invalidate(0, historyList[message.value.key].list = message.value.list, historyList);
    					}
    					break;
    			}
    		});
    	});

    	const click_handler = () => {
    		nadivscode.postMessage({
    			type: "onOpenWorkingFilesHistory",
    			value: undefined
    		});
    	};

    	const click_handler_1 = item => {
    		nadivscode.postMessage({
    			type: 'onOpenWorkingFilesHistory',
    			value: item.dirname
    		});
    	};

    	const click_handler_2 = key => {
    		nadivscode.postMessage({ type: "getHistoryOfMonth", value: key });
    	};

    	function child_value_binding(value) {
    		$setting = value;
    		setting.set($setting);
    	}

    	return [
    		historyList,
    		$setting,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		child_value_binding
    	];
    }

    class Sidebar extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    const app = new Sidebar({
        target: document.body
    });

    return app;

})();
//# sourceMappingURL=Sidebar.js.map

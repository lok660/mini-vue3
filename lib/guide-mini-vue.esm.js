const Fragment = Symbol("Fragment");
const Text = Symbol("Text");
//  创建vnode
//  type: 组件或者元素的类型  props: 属性  children: 子元素
function createVNode(type, props, children) {
    const vnode = {
        type,
        props,
        children,
        el: null,
        shapeFlag: getShapeFlag(type),
    };
    //  判断是否为组件
    if (Array.isArray(children)) {
        vnode.shapeFlag |= 8 /* ARRAY_CHILDREN */;
    }
    //  判断是否为element元素
    else if (typeof children === "string") {
        vnode.shapeFlag |= 4 /* TEXT_CHILDREN */;
    }
    else if (vnode.shapeFlag & 2 /* STATEFUL_COMPONENT */) {
        if (typeof children === 'object') {
            vnode.shapeFlag |= 16 /* SLOT_CHILDREN */;
        }
    }
    return vnode;
}
function createTextVNode(text) {
    return createVNode(Text, {}, text);
}
function getShapeFlag(type) {
    // 判断 vnode.type 是组件还是element元素
    return typeof type === "string"
        ? 1 /* ELEMENT */
        : 2 /* STATEFUL_COMPONENT */;
}

//  h函数的作用和createVNode函数是一样的，只是h函数的参数不同
//  h(type, props, children)
function h(type, props, children) {
    return createVNode(type, props, children);
}

function createAppAPI(render) {
    return function createApp(rootComponent) {
        // 返回一个app对象，里面带有mount方法(初始化挂载)
        console.log('createApp');
        return {
            mount(rootContainer) {
                if (typeof rootContainer === 'string') {
                    //  兼容传入的非DOM
                    rootContainer = document.querySelector(rootContainer);
                }
                // 根组件(render) -> vnode -> dom ->挂载到rootContainer
                // 1. 根组件 -> vnode(type type可以是vue component也可以是div等标签, props, children)
                const vnode = createVNode(rootComponent);
                // 2. 内部调用patch方法 ，进行递归的处理
                render(vnode, rootContainer);
            }
        };
    };
}

const extend = Object.assign;
const isObject = (value) => {
    return typeof value === "object" && value !== null;
};
const isFunction = (value) => {
    return typeof value === "function";
};
const hasOwn = (value, key) => {
    return Object.prototype.hasOwnProperty.call(value, key);
};
//  add-foo -> addFoo
const camelize = (str) => {
    return str.replace(/-(\w)/g, (_, c) => {
        return c ? c.toUpperCase() : "";
    });
};
//  add -> Add
const capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};
//  Add --> onAdd
const toHandlerKey = (str) => {
    return str ? "on" + capitalize(str) : "";
};

let activeEffect;
let shouldTrack;
//  根据Map容器来进行键值对存储 这样可以替换下面的dep定义
let targetMap = new Map();
class ReactiveEffect {
    constructor(fn, scheduler) {
        this.deps = []; //  被存放的dep容器集合
        this.active = true; //  表示是否被stop停止依赖相应
        this._fn = fn;
        this.scheduler = scheduler;
    }
    run() {
        if (!this.active) {
            //  stop状态直接调用我们的fn并返回
            return this._fn();
        }
        shouldTrack = true;
        activeEffect = this; //  通过this可获取当前的effect
        const result = this._fn();
        //  调用完后重置状态
        shouldTrack = false;
        activeEffect = undefined;
        //  返回这个副作用函数的返回结果
        return result;
    }
    stop() {
        //  停止依赖
        //  保证外部用户多次点击 cleanupEffect 函数也是只执行一次
        if (this.active) {
            cleanupEffect(this);
            if (this.onStop) {
                this.onStop();
            }
            this.active = false;
        }
    }
}
function cleanupEffect(effect) {
    //  删除dep记录 促使其的第二次执行scheduler
    if (effect.deps.length) {
        effect.deps.forEach(dep => {
            dep.delete(effect);
        });
        effect.deps.length = 0;
    }
}
//  当activeEffect不为undefined且shouldTrack为true时，可收集依赖
function isTracking() {
    //  当仅仅只是单独获取响应式数据时，并不会触发effect()函数
    //  此时的activeEffect很有可能是undefined
    //  不应该track时直接return
    return shouldTrack && activeEffect !== undefined;
}
function track(target, key) {
    if (!isTracking())
        return;
    let depsMap = targetMap.get(target);
    //  解决初始化获取依赖不存在的问题
    if (!depsMap) {
        depsMap = new Map();
        //  如果没有则创建一个set集合作为容器并添加到depsMap容器里
        targetMap.set(target, depsMap);
    }
    let dep = depsMap.get(key);
    if (!dep) {
        //  如果没有则创建一个set集合作为容器并添加到depsMap容器里
        dep = new Set();
        depsMap.set(key, dep);
    }
    trackEffect(dep);
}
function trackEffect(dep) {
    //  如果当前的effect已经在deps中存在，则不再重复添加
    if (dep.has(activeEffect)) {
        return;
    }
    //  否则添加到deps中
    dep.add(activeEffect);
    //  为当前的effect添加依赖
    activeEffect.deps.push(dep);
}
function trigger(target, key) {
    let depMap = targetMap.get(target);
    let dep = depMap.get(key);
    triggerEffect(dep);
}
function triggerEffect(dep) {
    //  如果dep为undefined，则直接返回
    if (!dep) {
        return;
    }
    //  否则遍历dep中的effect，调用其run()方法
    dep.forEach(effect => {
        if (effect.scheduler) {
            effect.scheduler();
        }
        else {
            effect.run();
        }
    });
}
function effect(fn, options = {}) {
    const scheduler = options.scheduler;
    //  创建一个新的effect实例
    const _effect = new ReactiveEffect(fn, scheduler);
    extend(_effect, options);
    //  当我们调用_effect的时候 立即执行一次 fn()
    _effect.run();
    //  希望在执行effect的时候通过回调返回的函数,将effect拿到的值的内容一起返回
    const runner = _effect.run.bind(_effect);
    //  给此runner添加effect属性并赋值当前副作用实例
    runner.effect = _effect;
    //  返回run函数 可让外部使用
    return runner;
}

//  因为所有proxy用到的get或set都是一样的
//  所以全局声明get和set使用，防止每创建一个响应式对象或只读对象所带来的创建get和set的内存消耗
const get = createGetter();
const set = createSetter();
const readonlyGet = createGetter(true);
const shallowReadonlyGet = createGetter(true, true);
function createGetter(isReadonly = false, shallow = false) {
    return function get(target, key, receiver) {
        const res = Reflect.get(target, key, receiver);
        if (key === "__V_isReactive" /* IS_REACTIVE */) {
            return !isReadonly;
        }
        else if (key === "__V_isReadonly" /* IS_READONLY */) {
            return isReadonly;
        }
        //  如果是shallowReadonly 就直接返回
        if (shallow)
            return res;
        //  如果是对象，根据isREadony判断返回深响应还是深只读
        if (isObject(res)) {
            return isReadonly ? readonly(res) : reactive(res);
        }
        //  如果不是只读对象,则收集依赖
        if (!isReadonly) {
            track(target, key);
        }
        return res;
    };
}
function createSetter() {
    return function set(target, key, receiver) {
        const res = Reflect.set(target, key, receiver);
        trigger(target, key);
        return res;
    };
}
const mutableHandlers = {
    // 缓存
    get,
    set,
};
const readonlyHandlers = {
    get: readonlyGet,
    set(target, key, value) {
        console.warn(`key:"${String(key)}" set 失败 因为 target 是 readonly`, target);
        return true;
    }
};
//  shallowReadonly的代理处理器，这里由于set和readonlyHandler相同所以用属性值覆盖优化了代码
const shallowReadonlyHandlers = extend({}, readonlyHandlers, {
    get: shallowReadonlyGet
});

//  做一个深度的reactive化
function reactive(target) {
    return createReactiveObject(target, mutableHandlers);
}
//  做一个只读的reactive化
function readonly(target) {
    return createReactiveObject(target, readonlyHandlers);
}
//  做一个shallowReadonly的reactive化
function shallowReadonly(target) {
    return createReactiveObject(target, shallowReadonlyHandlers);
}
function createReactiveObject(target, baseHandlers) {
    if (!isObject(target)) {
        console.warn('target ${target} 必须是一个对象');
    }
    return new Proxy(target, baseHandlers);
}

function emit(instance, event, ...args) {
    const { props } = instance;
    const handleName = toHandlerKey(camelize(event));
    const handler = props[handleName];
    handler && handler(...args);
}

function isRef(ref) {
    return !!ref.__v_isRef;
}
function unRef(ref) {
    return isRef(ref) ? ref.value : ref;
}
function ref() { }
function proxyRefs(objectWithRefs) {
    // get set
    return new Proxy(objectWithRefs, {
        get(target, key) {
            // get => age(ref) 返回value
            //  not ref => value
            return unRef(Reflect.get(target, key));
        },
        set(target, key, value) {
            //set =>ref .value
            if (isRef(target[key]) && !isRef(value)) {
                return (target[key].value = value);
            }
            else {
                return Reflect.set(target, key, value);
            }
        },
    });
}

function initProps(instance, rawProps) {
    //  初始化props
    instance.props = rawProps || {};
}

function initSlots(instance, children) {
    const { vnode } = instance;
    if (vnode.shapeFlag & 16 /* SLOT_CHILDREN */) {
        normalizeObjectSlots(children, instance.slots);
    }
}
function normalizeObjectSlots(children, slots) {
    for (const key in children) {
        const value = children[key];
        if (value) {
            slots[key] = props => normalizeSlotValue(value(props));
        }
    }
}
function normalizeSlotValue(value) {
    if (Array.isArray(value)) {
        return value;
    }
    return [value];
}

const publicPropertiesMap = {
    $el: i => i.vnode.el,
    $props: i => i.props,
    $slots: i => i.slots,
};
//  处理组件代理对象获取setup返回的数据对象以及$el属性值
//  此处的代理data,props是通过proxy代理的,与vue2不同
const PublicInstanceProxyHandlers = {
    get({ _: instance }, key) {
        const { setupState, props } = instance;
        //  如果是setupState中的属性，则返回setupState中的属性
        if (hasOwn(setupState, key)) {
            return setupState[key];
        }
        else if (hasOwn(props, key)) {
            return props[key];
        }
        else if (hasOwn(publicPropertiesMap, key)) {
            return publicPropertiesMap[key](instance);
        }
    }
};

//  通过虚拟节点生成实例对象
function createComponentInstance(vnode, parent) {
    const component = {
        vnode,
        parent,
        type: vnode.type,
        props: {},
        slots: {},
        provides: parent ? parent.provides : {},
        setupState: {},
        isMounted: false,
        subTree: {},
        emit: () => { }
    };
    component.emit = emit.bind(null, component);
    return component;
}
function setupComponent(instance) {
    //  初始化组件的props
    initProps(instance, instance.vnode.props);
    //  初始化组件的slots
    initSlots(instance, instance.vnode.children);
    //  初始化组件的setupState
    setupStatefulComponent(instance);
}
function setupStatefulComponent(instance) {
    //  将setup的返回结果挂载到实例上
    const component = instance.type;
    instance.proxy = new Proxy({ _: instance }, PublicInstanceProxyHandlers);
    const { setup } = component;
    if (setup) {
        setCurrentInstance(instance); //  通过全局变量拿到当前组件的实例对象
        //  setup 会返回一个function（name将会是一个render函数）
        //  或者 object（返回成一个对象 注入到当前组件的上下文中
        const setupResult = setup(shallowReadonly(instance.props), {
            emit: instance.emit,
        });
        setCurrentInstance(null); //  执行后清空,所以getCurrentInstance()在非setup中不能获取到
        handleSetupResult(instance, setupResult); //  处理setup的返回结果
    }
    else {
        //  如果没有setup方法，则直接完成组件的初始化
        finishComponentSetup(instance);
    }
}
function handleSetupResult(instance, setupResult) {
    //   steup () { return () => h('div', count.value) }
    if (isFunction(setupResult)) {
        //  如果setup返回的是一个function，则将其挂载到实例render上
        instance.render = setupResult;
    }
    //  steup() { return { count: count.value } }
    else if (isObject(setupResult)) {
        //  如果setup返回的是一个object,则将其注入到当前组件的上下文中
        instance.setupState = proxyRefs(setupResult);
    }
    else {
        console.warn(`setup() should return an object or a function.`);
    }
    //  完成组件的初始化
    finishComponentSetup(instance);
}
function finishComponentSetup(instance) {
    //  获取组件对象
    const component = instance.type;
    if (component.render) {
        //  如果组件有render方法，则将render方法挂载到实例上
        instance.render = component.render;
    }
    else {
        console.warn(`Component ${component.name} has no render function.`);
    }
}
let currentInstance = null; //  当前组件的实例对象
//  获取当前组件实例, 可以通过全局变量拿到
//  实际上 getCurrentInstance API就是调用这个方法
function getCurrentInstance() {
    return currentInstance;
}
//  设置当前组件实例
function setCurrentInstance(instance) {
    currentInstance = instance;
}

function createRenderer(options) {
    const { createElement: hostCreateElement, patchProp: hostPatchProp, insert: hostInsert, remove: hostRemove, setElementText: hostSetElementText } = options;
    function render(vnode, container) {
        // 调用patch 方便后续节点做遍历处理
        patch(null, vnode, container, null);
    }
    /**
     *
     * @param prevN   旧的虚拟节点
     * @param currN   当前的虚拟节点
     * @param container   渲染容器
     * @param parentComponent   父组件
     */
    function patch(prevN, currN, container, parentComponent) {
        console.log(container, currN);
        //  shapeFlag 标识vnode属于哪种类型
        const { type, shapeFlag } = currN;
        switch (type) {
            case Fragment:
                //  如果是Fragment节点,则只渲染children
                processFragment(prevN, currN, container, parentComponent);
                break;
            case Text:
                //  如果是Text节点,则只渲染text
                processText(prevN, currN, container);
                break;
            default:
                if (shapeFlag & 2 /* STATEFUL_COMPONENT */) {
                    //  如果是组件,则渲染组件
                    processComponent(prevN, currN, container, parentComponent);
                }
                else if (shapeFlag & 1 /* ELEMENT */) {
                    //  如果是element节点,则渲染element
                    processElement(prevN, currN, container, parentComponent);
                }
                break;
        }
    }
    function processElement(prevN, currN, container, parentComponent) {
        //  判断是否是新增节点
        if (!prevN) {
            //  如果是新增节点,则创建element
            mountElement(currN, container, parentComponent);
        }
        else {
            //  如果是旧节点,则更新element
            patchElement(prevN, currN, container, parentComponent);
        }
    }
    function patchElement(prevN, currN, container, parentComponent) {
        const prevProps = prevN.props || {};
        const currProps = currN.props || {};
        //  新的节点没有el
        const el = (currN.el = prevN.el);
        patchChildren(prevN, currN, el, parentComponent);
        patchProps(el, prevProps, currProps);
    }
    function patchProps(el, prevProps, currProps) {
        //  判断是否有新增属性
        for (const key in currProps) {
            if (!prevProps || prevProps[key] !== currProps[key]) {
                //  如果有新增属性,则调用hostPatchProp方法
                hostPatchProp(el, key, prevProps && prevProps[key], currProps[key]);
            }
        }
        if (currProps !== {}) {
            //  如果有删除属性,则调用hostPatchProp方法
            for (const key in prevProps) {
                if (!(key in currProps)) {
                    hostPatchProp(el, key, prevProps[key], null);
                }
            }
        }
    }
    function patchChildren(prevN, currN, container, parentComponent) {
        const { children: prevChildren, shapeFlag: prevShapeFlag } = prevN;
        const { children: currChildren, shapeFlag: currShapeFlag } = currN;
        if (currShapeFlag & 4 /* TEXT_CHILDREN */) {
            if (prevShapeFlag & 8 /* ARRAY_CHILDREN */) {
                unmountChildren(prevChildren); //  如果是旧节点,则销毁旧节点的子节点
            }
            if (prevChildren !== currChildren) {
                hostSetElementText(container, currChildren);
            }
        }
        else {
            if (prevShapeFlag & 4 /* TEXT_CHILDREN */) {
                hostSetElementText(container, '');
                mountChildren(currN, container, parentComponent);
            }
        }
    }
    function unmountChildren(children) {
        children.forEach(child => {
            hostRemove(child.el);
        });
    }
    function mountElement(vnode, container, parentComponent) {
        //  创建element
        const { children, shapeFlag, props, type } = vnode;
        const el = vnode.el = hostCreateElement(type);
        if (shapeFlag & 8 /* ARRAY_CHILDREN */) {
            //  如果是数组,说明传入的是vnode,则遍历渲染
            mountChildren(children, el, parentComponent);
        }
        else if (shapeFlag & 4 /* TEXT_CHILDREN */) {
            //  如果是文本,则设置文本
            hostSetElementText(el, children);
        }
        //  如果有props,则设置props
        if (props) {
            for (let key in props) {
                hostPatchProp(el, key, null, props[key]);
            }
        }
        hostInsert(el, container);
    }
    function processComponent(prevN, currN, container, parentComponent) {
        if (prevN) ;
        else {
            mountComponent(currN, container, parentComponent);
        }
    }
    function mountComponent(initialVNode, container, parentComponent) {
        //  创建实例对象
        const instance = createComponentInstance(initialVNode, parentComponent);
        //  处理组件的数据状态（reactive/ref/props/slots等）处理渲染函数等
        setupComponent(instance);
        //  渲染组件
        setupRenderEffect(instance, initialVNode, container);
    }
    function setupRenderEffect(instance, initialVNode, container) {
        effect(() => {
            if (!instance.isMounted) {
                console.log('mount');
                const { proxy } = instance;
                const subTree = instance.subTree = instance.render.call(proxy); //  将实例上的proxy代理到render函数上,,通过this.xxx调用
                //  初始化,没有旧的vnode,直接渲染组件
                patch(null, subTree, container, instance);
                initialVNode.el = subTree.el; //  将组件的虚拟dom赋值给vnode
                instance.isMounted = true; // 标识组件已经渲染完成
            }
            else {
                console.log('update');
                //  如果组件已经挂载,则更新组件
                const { proxy } = instance;
                const subTree = instance.render.call(proxy);
                const prevSubTree = instance.subTree; //  旧的vnode
                instance.subTree = subTree; //  新的vnode
                //  更新组件
                patch(prevSubTree, subTree, container, instance);
            }
        });
    }
    function mountChildren(children, container, parentComponent) {
        //  数组里面都是vnode
        //  需要遍历下去
        children.forEach(vnode => {
            patch(null, vnode, container, parentComponent);
        });
    }
    //  fragment节点直接处理children内容
    function processFragment(prevN, currN, container, parentComponent) {
        mountChildren(currN.children, container, parentComponent);
    }
    //  如果是Text节点,则生成text节点到dom容器
    function processText(prevN, currN, container) {
        const { children } = currN;
        const textNode = (currN.el = document.createTextNode(children));
        container.appendChild(textNode);
    }
    return {
        createApp: createAppAPI(render),
    };
}

/**
 *
 * @param slots 组件的所有插槽
 * @param name 具名插槽的name
 * @param props 作用域插槽的值
 * @param slotContent 插槽的默认内容
 * @returns 返回插槽的内容
 */
function renderSlots(slots, name = "default", props, slotContent) {
    const slot = slots[name];
    // 插槽内容用fragment节点渲染，这样不会给插槽生成额外的父级包裹节点
    if (slot && typeof slot == "function") {
        return h(Fragment, {}, slot(props));
    }
    else if (slotContent && typeof slotContent == "function") {
        return h(Fragment, {}, slotContent());
    }
}

function createElement(type) {
    return document.createElement(type);
}
function patchProp(el, key, prevValue, nextValue) {
    //  onClick onChange 
    const isOn = (key) => /^on[A-Z]/.test(key);
    if (isOn(key)) {
        const event = key.slice(2).toLowerCase(); //  onClick -> click
        el.addEventListener(event, nextValue);
    }
    else {
        if (nextValue === undefined || nextValue === null) {
            //  undefined null 的情况下,移除该属性
            el.removeAttribute(key);
        }
        else {
            //  其他情况下,设置该属性
            el.setAttribute(key, nextValue);
        }
    }
}
function insert(el, parent) {
    parent.append(el);
}
function remove(child) {
    const parent = child.parentNode;
    if (parent) {
        parent.removeChild(child);
    }
}
function setElementText(el, text) {
    el.textContent = text;
}
const renderer = createRenderer({
    createElement,
    patchProp,
    insert,
    remove,
    setElementText
});
function createApp(...args) {
    return renderer.createApp(...args);
}

export { createApp, createRenderer, createTextVNode, getCurrentInstance, h, proxyRefs, ref, renderSlots };

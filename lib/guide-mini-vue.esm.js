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
class ReactiveEffect {
    constructor(fn, scheduler) {
        this.deps = []; // 存储依赖 
        this.active = true;
        this._fn = fn;
        this.scheduler = scheduler;
    }
    run() {
        if (!this.active) { // 判断是否是第一次执行 如果是多次执行就不走getter方法了 -> stop
            return this._fn();
        }
        shouldTrack = true;
        activeEffect = this; // 通过 this 就拿到了当前的依赖的实例对象了
        let reslut = this._fn();
        shouldTrack = false;
        return reslut; // 将_fn 内部的返回值拿到
    }
    stop() {
        // 保证外部用户多次点击 cleanupEffect 函数也是只执行一次
        if (this.active) {
            cleanupEffect(this);
            if (this.onStop) { // 做函数的二次提交
                this.onStop();
            }
            this.active = false;
        }
    }
}
// 删除dep记录 促使其的第二次执行在scheduler
function cleanupEffect(effect) {
    effect.deps.forEach((dep) => {
        dep.delete(effect);
    });
}
let targetMap = new Map();
function track(target, key) {
    /**
     * track：我们需要将track传进来的数据起来 一个搜集的依赖的容器 这里通过 set 函数，来确定值的为一性
     * 我们的依赖项和track传进来的数据存在一个关系：target -> key -> dep  dep即我们实例出来的依赖：
     */
    if (!isTracking())
        return;
    let depsMap = targetMap.get(target); // 对象
    // 初始化一下数据 判断数据是否存在
    if (!depsMap) {
        depsMap = new Map();
        targetMap.set(target, depsMap);
    }
    let dep = depsMap.get(key);
    if (!dep) {
        dep = new Set();
        depsMap.set(key, dep); // 将对象里的值 转换出来 {a: 1} => {a: dep(1)}
    }
    trackEffects(dep);
}
function isTracking() {
    return shouldTrack && activeEffect !== "undefined";
    // 排除activeEffect的寄生环境 run 未执行的时候处于 undefined状态
}
function trackEffects(dep) {
    if (dep.has(activeEffect))
        return; // 判断在dep之前 数据收已经存在 存在就直接返回
    dep.add(activeEffect); // dep: target[key]    我们在这里通过add方法进行依赖收集
    activeEffect.deps.push(dep); // 通过activeEffect反向收集：用于实现实现 effect 的 stop 功能，提供依赖
}
function effect(fn, options = {}) {
    const scheduler = options.scheduler; //当响应式对象发生第二次修改时，进行一个标记
    const _effect = new ReactiveEffect(fn, scheduler); // fn 需要被一出来就调用 我们可以抽离出一个类来实现
    extend(_effect, options); // 取值
    // 当我们调用_effect的时候 是希望可以立即执行 fn 的
    _effect.run();
    // 这里我们希望在执行effect的时候通过回调返回的函数可以将effect拿到的值的内容一起返回
    const runner = _effect.run.bind(_effect); // 需要注意关联调用者的this指向
    runner.effect = _effect;
    return runner;
}
function trigger(target, key) {
    let depsMap = targetMap.get(target), dep = depsMap.get(key);
    triggerEffects(dep);
}
function triggerEffects(dep) {
    for (const effect of dep) {
        if (effect.scheduler) { //当响应式对象有标记 就调用scheduler函数的执行
            effect.scheduler();
        }
        else {
            effect.run();
        }
    }
}

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
        if (shallow)
            return res; //  如果是shallowReadonly 就直接返回
        //  如果是对象，则进行reactive化
        if (isObject(res)) {
            return isReadonly ? readonly(res) : reactive(res);
        }
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
        console.warn(`${key} 不可被设置`);
        return true;
    }
};
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
    if (vnode & 16 /* SLOT_CHILDREN */) {
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
    $el: i => i.$el,
    $data: i => i.$data,
    $props: i => i.$props,
    $slots: i => i.$slots,
};
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
        //  setup 会返回一个function（name将会是一个render函数）
        //  或者 object（返回成一个对象 注入到当前组件的上下文中
        const setupResult = setup(shallowReadonly(instance.props), {
            emit: instance.emit.bind(null, instance),
        });
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
    //  TODO 
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

function createRenderer(options) {
    const { createElement: hostCreateElement, patchProp: hostPatchProp, insert: hostInsert, remove: hostRemove, setElementText: hostSetElementText } = options;
    function render(vnode, container) {
        console.log('render', vnode, container);
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
            default:
                if (shapeFlag & 2 /* STATEFUL_COMPONENT */) {
                    //  如果是组件,则渲染组件
                    processComponent(prevN, currN, container, parentComponent);
                }
                else if (shapeFlag & 1 /* ELEMENT */) {
                    //  如果是element节点,则渲染element
                    processElement(prevN, currN, container, parentComponent);
                }
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
                mountChildren(currChildren, container, parentComponent);
            }
        }
    }
    function unmountChildren(children) {
        children.forEach(child => {
            const el = child.el;
            hostRemove(el);
        });
    }
    function mountElement(vnode, container, parentComponent) {
        //  创建element
        const el = vnode.el = hostCreateElement(vnode.type);
        const { children, shapeFlag, props } = vnode;
        if (shapeFlag & 8 /* ARRAY_CHILDREN */) {
            //  如果是数组,说明传入的是vnode,则遍历渲染
            mountChildren(vnode.children, el, parentComponent);
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
        container.append(textNode);
    }
    return {
        createApp: createAppAPI(render),
    };
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

export { createApp, createRenderer, h, proxyRefs, ref };

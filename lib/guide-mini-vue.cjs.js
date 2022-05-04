'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

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
const hasChanged = (newValue, oldValue) => {
    return !Object.is(newValue, oldValue);
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
    trackEffects(dep);
}
function trackEffects(dep) {
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
    triggerEffects(dep);
}
function triggerEffects(dep) {
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

class RefImpl {
    constructor(value) {
        this.__v_isRef = true; //  内部标记是否为ref
        this._rawValue = value;
        this._value = covert(value);
        this.dep = new Set();
    }
    get value() {
        //  收集依赖并返回值
        trackRefValue(this);
        //  实际上 ref.value 就是构造函数中的 this._value
        //  内部进行了reactive化 
        return this._value;
    }
    set value(newVal) {
        //  值发生改变才进行依赖触发
        if (hasChanged(this._rawValue, newVal)) {
            this._rawValue = newVal;
            this._value = covert(newVal);
            triggerEffects(this.dep);
        }
    }
}
//  如果当前可以收集依赖则收集跟当前ref对象有关的依赖
function trackRefValue(ref) {
    if (isTracking()) {
        trackEffects(ref.dep);
    }
}
//  reactive化
function covert(value) {
    return isObject(value) ? reactive(value) : value;
}
function isRef(ref) {
    return !!ref.__v_isRef;
}
function unRef(ref) {
    return isRef(ref) ? ref.value : ref;
}
function ref(value) {
    return new RefImpl(value);
}
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

function shouldUpdateComponent(prevVNode, nextVNode) {
    const { props: prevProps } = prevVNode;
    const { props: nextProps } = nextVNode;
    for (const key in nextProps) {
        if (nextProps[key] !== prevProps[key])
            return true;
    }
    return false;
}

const queue = [];
let isFlushPending = false;
const p = Promise.resolve();
function nextTick(fn) {
    return fn ? p.then(fn) : p;
}
function queueJobs(job) {
    if (!queue.includes(job)) {
        queue.push(job);
    }
    // 微任务执行job
    queueFlush();
}
/**
 * @description: 使用Promise来异步执行job，减少更新的次数
 * @param {*}
 * @return {*}
 */
function queueFlush() {
    if (isFlushPending) {
        return;
    }
    isFlushPending = true;
    nextTick(flushJobs);
}
function flushJobs() {
    isFlushPending = false;
    let job;
    while ((job = queue.shift())) {
        job && job();
    }
}

function createRenderer(options) {
    const { createElement: hostCreateElement, patchProp: hostPatchProp, insert: hostInsert, remove: hostRemove, setElementText: hostSetElementText } = options;
    function render(vnode, container) {
        // 调用patch 方便后续节点做遍历处理
        patch(null, vnode, container, null, null);
    }
    /**
     *
     * @param n1   旧的虚拟节点
     * @param n2   当前的虚拟节点
     * @param container   渲染容器
     * @param parentComponent   父组件
     */
    function patch(n1, n2, container, parentComponent, anchor) {
        //  shapeFlag 标识vnode属于哪种类型
        const { type, shapeFlag } = n2;
        switch (type) {
            case Fragment:
                //  如果是Fragment节点,则只渲染children
                processFragment(n1, n2, container, parentComponent, anchor);
                break;
            case Text:
                //  如果是Text节点,则只渲染text
                processText(n1, n2, container);
                break;
            default:
                if (shapeFlag & 2 /* STATEFUL_COMPONENT */) {
                    //  如果是组件,则渲染组件
                    processComponent(n1, n2, container, parentComponent, anchor);
                }
                else if (shapeFlag & 1 /* ELEMENT */) {
                    //  如果是element节点,则渲染element
                    processElement(n1, n2, container, parentComponent, anchor);
                }
                break;
        }
    }
    function processElement(n1, n2, container, parentComponent, anchor) {
        //  判断是否是新增节点
        if (!n1) {
            //  如果是新增节点,则创建element
            mountElement(n2, container, parentComponent, anchor);
        }
        else {
            //  如果是旧节点,则更新element
            patchElement(n1, n2, container, parentComponent, anchor);
        }
    }
    function patchElement(n1, n2, container, parentComponent, anchor) {
        const oldProps = n1.props || {};
        const newProps = n2.props || {};
        //  新的节点没有el
        const el = (n2.el = n1.el);
        patchChildren(n1, n2, el, parentComponent, anchor);
        patchProps(el, oldProps, newProps);
    }
    function patchProps(el, oldProps, newProps) {
        //  判断是否有新增属性
        for (const key in newProps) {
            const prevProp = oldProps[key];
            const nextProp = newProps[key];
            if (prevProp !== nextProp) {
                hostPatchProp(el, key, prevProp, nextProp);
            }
        }
        if (newProps !== {}) {
            //  如果有删除属性,则调用hostPatchProp方法
            for (const key in oldProps) {
                if (!(key in newProps)) {
                    hostPatchProp(el, key, oldProps[key], null);
                }
            }
        }
    }
    function patchChildren(n1, n2, container, parentComponent, anchor) {
        const { children: prevChildren, shapeFlag: prevShapeFlag } = n1;
        const { children: nextChildren, shapeFlag: nextShapeFlag } = n2;
        if (nextShapeFlag & 4 /* TEXT_CHILDREN */) {
            if (prevShapeFlag & 8 /* ARRAY_CHILDREN */) {
                unmountChildren(prevChildren); //  如果是旧节点,则销毁旧节点的子节点
            }
            if (prevChildren !== nextChildren) {
                hostSetElementText(container, nextChildren);
            }
        }
        else {
            if (prevShapeFlag & 4 /* TEXT_CHILDREN */) {
                hostSetElementText(container, '');
                mountChildren(nextChildren, container, parentComponent, anchor);
            }
            else {
                patchKeyedChildren(prevChildren, nextChildren, container, parentComponent, anchor);
            }
        }
    }
    function patchKeyedChildren(//  对keyed children进行更新
    c1, c2, container, parentComponent, parentAnchor) {
        const l2 = c2.length;
        let i = 0; //  新旧节点指向同步的指针
        let e1 = c1.length - 1; //  变更前节点的尾下标
        let e2 = l2 - 1; //  变更后节点的尾下标
        //  判断更新前后两个节点类型和Key是否一致
        function isSomeVNodeType(n1, n2) {
            return n1.type === n2.type && n1.key === n2.key;
        }
        //  左侧对比
        //  从左往右依次查找,如果节点可以复用,则继续往右,不能就停止循环
        while (i <= e1 && i <= e2) {
            //  取出新老节点
            const n1 = c1[i];
            const n2 = c2[i];
            //  是否一样
            if (isSomeVNodeType(n1, n2)) {
                //  递归调用
                patch(n1, n2, container, parentComponent, parentAnchor);
            }
            else {
                //  停止循环
                break;
            }
            //  指针往右移动
            i++;
        }
        //  右侧对比
        while (i <= e1 && i <= e2) {
            const n1 = c1[e1];
            const n2 = c2[e2];
            if (isSomeVNodeType(n1, n2)) {
                patch(n1, n2, container, parentComponent, parentAnchor);
            }
            else {
                break;
            }
            e1--;
            e2--;
        }
        //  经过前两步的处理，新旧队列已经进一步缩短了,相同部分已经处理完毕
        //  故剩下的节点就可能存在三种情况
        //  1.有新增的节点
        //  2.有节点被删除了
        //  3.相同的节点，但是移动了位置
        //  实际场景中,那么只有存在下面三种情况
        //  仅有新增的节点(此时一定i > e1)
        //  仅进行了节点删除(此时一定i > e2)
        //  乱序的，一定有移动的节点，其中可能包含新增或有删除的节点(此时一定有i <= e2且i <= e1)
        //  新的比老的多,需要进行创建,i > e1 && i <= e2
        if (i > e1) {
            if (i <= e2) {
                //  当前节点后面的节点
                const nextPos = e2 + 1;
                //  以这个节点为锚点在其之前添加元素，没有则添加到父节点最后
                const anchor = nextPos < l2 ? c2[nextPos].el : null;
                while (i <= e2) {
                    patch(null, c2[i], container, parentComponent, anchor);
                    i++;
                }
            }
        }
        else if (i > e2) {
            //  老的比新的多,需要进行删除
            while (i <= e1) {
                hostRemove(c1[i].el);
                i++;
            }
        }
        else {
            //  中间乱序的情况
            let s1 = i; //  新节点的指针
            let s2 = i; //  老节点的指针
            const toBePatched = e2 - s2 + 1; //  需要patch的节点数
            let patched = 0; //  已经patch的节点数
            const keyToNewIndexMap = new Map(); //  新节点的key到新节点的指针的映射
            const newIndexToOldIndexMap = new Array(toBePatched); //  新节点的指针到老节点的指针的映射
            let moved = false; //  是否有节点被移动了位置
            let maxNewIndexSoFar = 0; //  记录节点是否已经移动
            for (let i = 0; i < toBePatched; i++) {
                newIndexToOldIndexMap[i] = 0;
            }
            for (let i = s2; i <= e2; i++) {
                const nextChild = c2[i];
                keyToNewIndexMap.set(nextChild.key, i);
            }
            for (let i = s1; i <= e1; i++) {
                const prevChild = c1[i];
                if (patched >= toBePatched) {
                    hostRemove(prevChild.el);
                    continue;
                }
                // 有key直接找映射表
                let newIndex;
                if (prevChild.key !== null) {
                    newIndex = keyToNewIndexMap.get(prevChild.key);
                }
                else { // 没有key继续遍历
                    for (let j = s2; j <= e2; j++) {
                        // 借助已经封装好的方法
                        if (isSomeVNodeType(prevChild, c2[j])) {
                            newIndex = j;
                            break;
                        }
                    }
                }
                //    新值中没有老值,进行删除
                if (newIndex === undefined) {
                    hostRemove(prevChild.el);
                }
                else {
                    // 新值大于记录的值 重置最大的值
                    if (newIndex >= maxNewIndexSoFar) {
                        maxNewIndexSoFar = newIndex;
                    }
                    else {
                        // 新值小于记录的值说明进行位置的移动
                        moved = true;
                    }
                    // 证明新节点是存在的  在此处将老节点进行遍历对新节点进行重新赋值
                    // 因为此处我们的索引计算包含了前面的部分所以需要减去前面的部分也就是s2
                    // 由于新节点可能在老节点中是不存在的 所以需要考虑到为0的情况 可以将我们的i加1处理
                    newIndexToOldIndexMap[newIndex - s2] = i + 1;
                    //    存在继续进行深度对比
                    patch(prevChild, c2[newIndex], container, parentComponent, null);
                    patched++;
                }
            }
            // 给最长递增子序列算法准备进行处理的数组
            const increasingNewIndexSequence = moved ? getSequence(newIndexToOldIndexMap) : []; // 需要进行位置的移动时才调用算法,减少不必要的逻辑代码
            let j = increasingNewIndexSequence.length - 1;
            // 获取到我们的最长递增子序列这是一个数组,需要将我们的老值进行遍历 然后
            // 利用两个指针分别指向我们的最长递增子序列和我们的老值 如果老值没有匹配 则说明需要进行位置移动
            // toBePatched就是我们的新值的中间乱序的长度
            for (let i = toBePatched - 1; i >= 0; i--) {
                const nextIndex = i + s2;
                const nextChild = c2[nextIndex];
                const anchor = nextIndex + 1 < l2 ? c2[nextIndex + 1].el : null;
                if (newIndexToOldIndexMap[i] === 0) {
                    // 在旧值中找不到新值的映射时就需要新创建
                    patch(null, nextChild, container, parentComponent, anchor);
                }
                else if (moved) { // 需要移动时才进入相关的逻辑判断
                    if (j < 0 || i !== increasingNewIndexSequence[j]) {
                        console.log('需要进行位置移动');
                        hostInsert(nextChild.el, container, anchor);
                    }
                    else {
                        // 不需要进行移动的话 将j的指针右移
                        j--;
                    }
                }
            }
        }
    }
    function unmountChildren(children) {
        children.forEach(child => {
            hostRemove(child.el);
        });
    }
    function mountElement(vnode, container, parentComponent, anchor) {
        //  创建element
        const { children, shapeFlag, props, type } = vnode;
        const el = vnode.el = hostCreateElement(type);
        if (shapeFlag & 8 /* ARRAY_CHILDREN */) {
            //  如果是数组,说明传入的是vnode,则遍历渲染
            mountChildren(children, el, parentComponent, anchor);
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
        hostInsert(el, container, anchor);
    }
    function processComponent(n1, n2, container, parentComponent, anchor) {
        if (n1) {
            //  如果存在旧的vnode,则更新组件
            updateComponent(n1, n2);
        }
        else {
            mountComponent(n2, container, parentComponent, anchor);
        }
    }
    function updateComponent(n1, n2) {
        // 判断是否需要更新
        const instance = (n2.component = n1.component);
        if (shouldUpdateComponent(n1, n2)) {
            instance.next = n2;
            instance.update();
        }
        else {
            // 重置虚拟节点
            n2.el = n1.el;
            n2.vnode = n2;
        }
    }
    function mountComponent(initialVNode, container, parentComponent, anchor) {
        //  创建实例对象
        const instance = createComponentInstance(initialVNode, parentComponent);
        //  处理组件的数据状态（reactive/ref/props/slots等）处理渲染函数等
        setupComponent(instance);
        //  渲染组件
        setupRenderEffect(instance, initialVNode, container, anchor);
    }
    function setupRenderEffect(instance, initialVNode, container, anchor) {
        effect(() => {
            if (!instance.isMounted) {
                console.log('mount');
                const { proxy } = instance;
                const subTree = instance.subTree = instance.render.call(proxy); //  将实例上的proxy代理到render函数上,,通过this.xxx调用
                //  初始化,没有旧的vnode,直接渲染组件
                patch(null, subTree, container, instance, anchor);
                initialVNode.el = subTree.el; //  将组件的虚拟dom赋值给vnode
                instance.isMounted = true; // 标识组件已经渲染完成
            }
            else {
                console.log('update');
                const { next, vnode } = instance;
                if (next) {
                    next.el = vnode.el;
                    updateComponentPreRender(instance, next);
                }
                //  如果组件已经挂载,则更新组件
                const { proxy } = instance;
                const subTree = instance.render.call(proxy);
                const prevSubTree = instance.subTree; //  旧的vnode
                instance.subTree = subTree; //  新的vnode
                //  更新组件
                patch(prevSubTree, subTree, container, instance, anchor);
            }
        }, {
            scheduler() {
                console.log('update-scheduler');
                queueJobs(instance.update);
            },
        });
    }
    function mountChildren(children, container, parentComponent, anchor) {
        //  数组里面都是vnode
        //  需要遍历下去
        children.forEach(vnode => {
            patch(null, vnode, container, parentComponent, anchor);
        });
    }
    //  fragment节点直接处理children内容
    function processFragment(n1, n2, container, parentComponent, anchor) {
        mountChildren(n2.children, container, parentComponent, anchor);
    }
    //  如果是Text节点,则生成text节点到dom容器
    function processText(n1, n2, container) {
        const { children } = n2;
        const textNode = (n2.el = document.createTextNode(children));
        container.appendChild(textNode);
    }
    return {
        createApp: createAppAPI(render),
    };
}
/**
 * @description: 更新Component的vnode
 * 将 新的 vnode 赋值给  vnode
 * 赋值后重置next节点
 * @param {*} instance
 * @param {*} nextVNode
 * @return {*}
 */
function updateComponentPreRender(instance, nextVNode) {
    instance.vnode = nextVNode;
    instance.next = null;
    instance.props = nextVNode.props;
}
// 最长递增子序列算法
function getSequence(arr) {
    const p = arr.slice();
    const result = [0]; // 存储长度为i的递增子序列的索引
    let j, u, v, c;
    const len = arr.length;
    for (let i = 0; i < len; i++) {
        const arrI = arr[i];
        if (arrI !== 0) {
            // 把j赋值为数组最后一项 
            j = result[result.length - 1];
            // result存储的最后一个值小于当前值
            if (arr[j] < arrI) {
                //    存储在result更新前的最后一个索引的值
                p[i] = j;
                result.push(i);
                continue;
            }
            u = 0;
            v = result.length - 1;
            // 二分搜索 查找比arrI小的节点  更新result的值
            while (u < v) {
                c = (u + v) >> 1;
                if (arr[result[c]] < arrI) {
                    u = c + 1;
                }
                else {
                    v = c;
                }
            }
            if (arrI < arr[result[u]]) {
                if (u > 0) {
                    p[i] = result[u - 1];
                }
                result[u] = i;
            }
        }
    }
    u = result.length;
    v = result[u - 1];
    // 回溯数组 找到最终的索引
    while (u-- > 0) {
        result[u] = v;
        v = p[v];
    }
    return result;
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

//  存储
function provide(key, value) {
    //  getCurrentInstance必须在setup作用域下才能获取到有效的currentInstance
    const currentInstance = getCurrentInstance();
    if (currentInstance) {
        let { provides } = currentInstance;
        const parentProvides = currentInstance.parent.provides || {};
        if (provides === parentProvides) {
            provides = currentInstance.provides = Object.create(parentProvides);
        }
        //  将key和value挂载到provides上
        //  privides是挂载在当前实例
        provides[key] = value;
    }
}
//  获取
function inject(key, defaultValue) {
    const currentInstance = getCurrentInstance();
    if (currentInstance) {
        const parentProvides = currentInstance.parent.provides || {};
        //  如果当前有provides，则直接从provides中获取
        if (key in parentProvides) {
            return parentProvides[key];
        }
        else if (defaultValue) {
            if (typeof defaultValue === 'function') {
                return defaultValue();
            }
            return defaultValue;
        }
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
function insert(el, parent, author) {
    parent.insertBefore(el, author);
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

exports.createApp = createApp;
exports.createRenderer = createRenderer;
exports.createTextVNode = createTextVNode;
exports.getCurrentInstance = getCurrentInstance;
exports.h = h;
exports.inject = inject;
exports.nextTick = nextTick;
exports.provide = provide;
exports.proxyRefs = proxyRefs;
exports.ref = ref;
exports.renderSlots = renderSlots;

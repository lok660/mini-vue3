import { shallowReadonly } from '../reactivity/reactive'
import { isFunction, isObject } from '../shared/index'
import { emit } from './componentEmit'
import { proxyRefs } from '../reactivity/ref'
import { initProps } from './componentProps'
import { initSlots } from './componentSlots'
import { PublicInstanceProxyHandlers } from './componentPublicInstance'

//  通过虚拟节点生成实例对象
export function createComponentInstance(vnode, parent) {

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
  }

  component.emit = emit.bind(null, component) as any

  return component
}

export function setupComponent(instance) {

  //  初始化组件的props
  initProps(instance, instance.vnode.props)
  //  初始化组件的slots
  initSlots(instance, instance.vnode.children)
  //  初始化组件的setupState
  setupStatefulComponent(instance)
}

function setupStatefulComponent(instance) {
  //  将setup的返回结果挂载到实例上
  const component = instance.type
  instance.proxy = new Proxy(
    { _: instance },
    PublicInstanceProxyHandlers
  )

  const { setup } = component

  if (setup) {
    setCurrentInstance(instance)  //  通过全局变量拿到当前组件的实例对象
    //  setup 会返回一个function（name将会是一个render函数）
    //  或者 object（返回成一个对象 注入到当前组件的上下文中
    const setupResult = setup(shallowReadonly(instance.props), {
      emit: instance.emit.bind(null, instance),
    })
    setCurrentInstance(null)  //  执行后清空,所以getCurrentInstance()在非setup中不能获取到
    handleSetupResult(instance, setupResult)  //  处理setup的返回结果
  } else {
    //  如果没有setup方法，则直接完成组件的初始化
    finishComponentSetup(instance)
  }
}

function handleSetupResult(instance, setupResult) {
  //   steup () { return () => h('div', count.value) }
  if (isFunction(setupResult)) {
    //  如果setup返回的是一个function，则将其挂载到实例render上
    instance.render = setupResult
  }
  //  steup() { return { count: count.value } }
  else if (isObject(setupResult)) {
    //  如果setup返回的是一个object,则将其注入到当前组件的上下文中
    instance.setupState = proxyRefs(setupResult)
  }
  else {
    console.warn(`setup() should return an object or a function.`)
  }
  //  完成组件的初始化
  finishComponentSetup(instance)
}

function finishComponentSetup(instance) {
  //  获取组件对象
  const component = instance.type
  if (component.render) {
    //  如果组件有render方法，则将render方法挂载到实例上
    instance.render = component.render
  }
  else {
    console.warn(`Component ${component.name} has no render function.`)
  }
}

let currentInstance = null  //  当前组件的实例对象

//  获取当前组件实例, 可以通过全局变量拿到
//  实际上 getCurrentInstance API就是调用这个方法
export function getCurrentInstance() {
  return currentInstance
}

//  设置当前组件实例
export function setCurrentInstance(instance) {
  currentInstance = instance
}
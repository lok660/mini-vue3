import { emit } from './componentEmit'

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

  component.emit = emit.bind(null, component)

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
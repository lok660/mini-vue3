import { effect } from "../reactivity/effect";
import { ShapeFlags } from '../shared/shapeFlags'
import { createComponentInstance, setupComponent } from './component'
import { Fragment, Text } from "./vnode";

export function createRenderer(options) {

  const {
    createElement: hostCreateElement,
    patchProp: hostPatchProp,
    insert: hostInsert,
    remove: hostRemove,
    setElementText: hostSetElementText
  } = options

  function render(vnode, container) {
    // 调用patch 方便后续节点做遍历处理
    patch(null, vnode, container, null)
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
    const { type, shapeFlag } = currN

    switch (type) {
      case Fragment:
        //  如果是Fragment节点,则只渲染children
        processFragment(prevN, currN, container, parentComponent)
        break;
      case Text:
        //  如果是Text节点,则只渲染text
        processText(prevN, currN, container)
      default:
        if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
          //  如果是组件,则渲染组件
          processComponent(prevN, currN, container, parentComponent)
        }
        else if (shapeFlag & ShapeFlags.ELEMENT) {
          //  如果是element节点,则渲染element
          processElement(prevN, currN, container, parentComponent)
        }
    }
  }

  function processComponent(prevN, currN, container, parentComponent) {
    if (prevN) {
      //  如果存在旧的vnode,则更新组件
      // updateComponent(prevN, currN)
    } else {
      mountComponent(currN, container, parentComponent)
    }
  }

  function mountComponent(initialVNode, container, parentComponent) {
    //  创建实例对象
    const instance = createComponentInstance(initialVNode, parentComponent)
    //  处理组件的数据状态（reactive/ref/props/slots等）处理渲染函数等
    setupComponent(instance)
    //  渲染组件
    setupRenderEffect(instance, initialVNode, container)
  }

  function setupRenderEffect(instance, initialVNode, container) {
    effect(() => {
      if (!instance.isMounted) {
        console.log('mount')
        //  如果组件未挂载,则挂载组件
        const { proxy } = instance
        const subTree = instance.subTree = instance.render.call(proxy)
        //  初始化,没有旧的vnode,直接渲染组件
        patch(null, subTree, container, instance)

        initialVNode.el = subTree.el  //  将组件的虚拟dom赋值给vnode
        instance.isMounted = true // 标识组件已经渲染完成
      } else {
        console.log('update')
        //  如果组件已经挂载,则更新组件
        const { proxy } = instance
        const subTree = instance.render.call(proxy)
        const prevSubTree = instance.subTree  //  旧的vnode
        instance.subTree = subTree  //  新的vnode
        //  更新组件
        patch(prevSubTree, subTree, container, instance)
      }
    })
  }

  function mountChildren(children, container, parentComponent) {
    //  数组里面都是vnode
    //  需要遍历下去
    children.forEach(vnode => {
      patch(null, vnode, container, parentComponent)
    })
  }

  //  fragment节点直接处理children内容
  function processFragment(prevN, currN, container, parentComponent) {
    mountChildren(currN.children, container, parentComponent)
  }

  //  如果是Text节点,则生成text节点到dom容器
  function processText(prevN, currN, container) {
    const { children } = currN
    const textNode = (currN.el = document.createTextNode(children))
    container.append(textNode)
  }
}